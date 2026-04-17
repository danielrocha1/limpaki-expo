package realtime

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"sync"
	"time"
)

const (
	opcodeContinuation = 0x0
	opcodeText         = 0x1
	opcodeBinary       = 0x2
	opcodeClose        = 0x8
	opcodePing         = 0x9
	opcodePong         = 0xA
)

var (
	errWebSocketClosed      = errors.New("websocket fechado")
	errUnsupportedOpcode    = errors.New("opcode websocket nao suportado")
	errFragmentedNotAllowed = errors.New("frames fragmentados nao sao suportados")
)

type WSConn struct {
	conn   net.Conn
	reader *bufio.Reader
	mu     sync.Mutex
}

func NewWSConn(conn net.Conn) *WSConn {
	return &WSConn{
		conn:   conn,
		reader: bufio.NewReader(conn),
	}
}

func (c *WSConn) withConn(action func(net.Conn) error) (err error) {
	conn := c.snapshotConn()
	if conn == nil {
		return errWebSocketClosed
	}

	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("websocket connection panic: %v", recovered)
		}
	}()

	return action(conn)
}

func (c *WSConn) snapshotConn() net.Conn {
	if c == nil {
		return nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn
}

func (c *WSConn) snapshotReader() *bufio.Reader {
	if c == nil {
		return nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	return c.reader
}

func ComputeWebSocketAcceptKey(clientKey string) string {
	hash := sha1.Sum([]byte(strings.TrimSpace(clientKey) + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
	return base64.StdEncoding.EncodeToString(hash[:])
}

func (c *WSConn) Close() error {
	if c == nil {
		return errWebSocketClosed
	}

	c.mu.Lock()
	conn := c.conn
	c.conn = nil
	c.reader = nil
	c.mu.Unlock()

	if conn == nil {
		return errWebSocketClosed
	}

	return conn.Close()
}

func (c *WSConn) SetReadDeadline(deadline time.Time) error {
	return c.withConn(func(conn net.Conn) error {
		return conn.SetReadDeadline(deadline)
	})
}

func (c *WSConn) SetWriteDeadline(deadline time.Time) error {
	return c.withConn(func(conn net.Conn) error {
		return conn.SetWriteDeadline(deadline)
	})
}

func (c *WSConn) ReadMessage() ([]byte, error) {
	for {
		opcode, payload, err := c.readFrame()
		if err != nil {
			return nil, err
		}

		switch opcode {
		case opcodeText:
			return payload, nil
		case opcodePing:
			if err := c.WriteControl(opcodePong, payload); err != nil {
				return nil, err
			}
		case opcodePong:
			return nil, nil
		case opcodeClose:
			_ = c.WriteControl(opcodeClose, nil)
			return nil, errWebSocketClosed
		case opcodeBinary:
			return nil, errUnsupportedOpcode
		default:
			return nil, errUnsupportedOpcode
		}
	}
}

func (c *WSConn) WriteText(payload []byte) error {
	return c.writeFrame(opcodeText, payload)
}

func (c *WSConn) WriteControl(opcode byte, payload []byte) error {
	return c.writeFrame(opcode, payload)
}

func (c *WSConn) readFrame() (byte, []byte, error) {
	reader := c.snapshotReader()
	if reader == nil {
		return 0, nil, errWebSocketClosed
	}

	header := make([]byte, 2)
	if _, err := io.ReadFull(reader, header); err != nil {
		return 0, nil, err
	}

	fin := header[0]&0x80 != 0
	opcode := header[0] & 0x0F
	if !fin || opcode == opcodeContinuation {
		return 0, nil, errFragmentedNotAllowed
	}

	masked := header[1]&0x80 != 0
	payloadLength := uint64(header[1] & 0x7F)

	switch payloadLength {
	case 126:
		extended := make([]byte, 2)
		if _, err := io.ReadFull(reader, extended); err != nil {
			return 0, nil, err
		}
		payloadLength = uint64(binary.BigEndian.Uint16(extended))
	case 127:
		extended := make([]byte, 8)
		if _, err := io.ReadFull(reader, extended); err != nil {
			return 0, nil, err
		}
		payloadLength = binary.BigEndian.Uint64(extended)
	}

	if payloadLength > maxMessageSize {
		return 0, nil, io.ErrShortBuffer
	}

	maskKey := make([]byte, 4)
	if masked {
		if _, err := io.ReadFull(reader, maskKey); err != nil {
			return 0, nil, err
		}
	}

	payload := make([]byte, payloadLength)
	if payloadLength > 0 {
		if _, err := io.ReadFull(reader, payload); err != nil {
			return 0, nil, err
		}
	}

	if masked {
		for index := range payload {
			payload[index] ^= maskKey[index%4]
		}
	}

	return opcode, payload, nil
}

func (c *WSConn) writeFrame(opcode byte, payload []byte) error {
	if c == nil {
		return errWebSocketClosed
	}

	c.mu.Lock()
	conn := c.conn
	if conn == nil {
		c.mu.Unlock()
		return errWebSocketClosed
	}
	c.mu.Unlock()

	header := []byte{0x80 | opcode}
	payloadLength := len(payload)

	switch {
	case payloadLength <= 125:
		header = append(header, byte(payloadLength))
	case payloadLength <= 65535:
		header = append(header, 126)
		extended := make([]byte, 2)
		binary.BigEndian.PutUint16(extended, uint16(payloadLength))
		header = append(header, extended...)
	default:
		header = append(header, 127)
		extended := make([]byte, 8)
		binary.BigEndian.PutUint64(extended, uint64(payloadLength))
		header = append(header, extended...)
	}

	if _, err := c.writeBytes(header); err != nil {
		return err
	}
	if payloadLength == 0 {
		return nil
	}

	_, err := c.writeBytes(payload)
	return err
}

func (c *WSConn) writeBytes(payload []byte) (written int, err error) {
	conn := c.snapshotConn()
	if conn == nil {
		return 0, errWebSocketClosed
	}

	defer func() {
		if recovered := recover(); recovered != nil {
			written = 0
			err = fmt.Errorf("websocket write panic: %v", recovered)
		}
	}()

	return conn.Write(payload)
}
