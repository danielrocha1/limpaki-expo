package realtime

import (
	"encoding/json"
	"io"
	"net"
	"testing"
	"time"
)

func TestComputeWebSocketAcceptKey(t *testing.T) {
	const clientKey = "dGhlIHNhbXBsZSBub25jZQ=="
	const expected = "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="

	if got := ComputeWebSocketAcceptKey(clientKey); got != expected {
		t.Fatalf("unexpected accept key: got %q want %q", got, expected)
	}
}

func TestWSConnReadMessageUnmasksClientFrame(t *testing.T) {
	serverConn, clientConn := net.Pipe()
	defer serverConn.Close()
	defer clientConn.Close()

	wsConn := NewWSConn(serverConn)
	errCh := make(chan error, 1)

	go func() {
		frame := []byte{
			0x81,
			0x85,
			0x37, 0xFA, 0x21, 0x3D,
			0x7F, 0x9F, 0x4D, 0x51, 0x58,
		}
		_, err := clientConn.Write(frame)
		errCh <- err
	}()

	message, err := wsConn.ReadMessage()
	if err != nil {
		t.Fatalf("ReadMessage() error = %v", err)
	}

	if got := string(message); got != "Hello" {
		t.Fatalf("unexpected message payload: got %q want %q", got, "Hello")
	}

	if err := <-errCh; err != nil {
		t.Fatalf("write frame error: %v", err)
	}
}

func TestWSConnWriteTextWritesServerFrame(t *testing.T) {
	serverConn, clientConn := net.Pipe()
	defer serverConn.Close()
	defer clientConn.Close()

	wsConn := NewWSConn(serverConn)
	errCh := make(chan error, 1)

	go func() {
		errCh <- wsConn.WriteText([]byte("ok"))
	}()

	frame := make([]byte, 4)
	if _, err := io.ReadFull(clientConn, frame); err != nil {
		t.Fatalf("failed to read frame: %v", err)
	}

	expected := []byte{0x81, 0x02, 'o', 'k'}
	for index, want := range expected {
		if frame[index] != want {
			t.Fatalf("unexpected frame byte at %d: got 0x%X want 0x%X", index, frame[index], want)
		}
	}

	if err := <-errCh; err != nil {
		t.Fatalf("WriteText() error = %v", err)
	}
}

func TestHubDispatchTargetsUsersRolesAndExclusions(t *testing.T) {
	hub := NewHub()

	clientA := &Client{hub: hub, userID: 1, userRole: "diarista", send: make(chan []byte, 1)}
	clientB := &Client{hub: hub, userID: 2, userRole: "cliente", send: make(chan []byte, 1)}
	clientC := &Client{hub: hub, userID: 3, userRole: "diarista", send: make(chan []byte, 1)}

	hub.clients[clientA] = struct{}{}
	hub.clients[clientB] = struct{}{}
	hub.clients[clientC] = struct{}{}
	hub.clientsByUser[1] = map[*Client]struct{}{clientA: {}}
	hub.clientsByUser[2] = map[*Client]struct{}{clientB: {}}
	hub.clientsByUser[3] = map[*Client]struct{}{clientC: {}}
	hub.clientsByRole["diarista"] = map[*Client]struct{}{clientA: {}, clientC: {}}
	hub.clientsByRole["cliente"] = map[*Client]struct{}{clientB: {}}

	hub.Publish("offer.created", map[string]string{"status": "open"}, DispatchOptions{
		UserIDs:        []uint{2},
		Roles:          []string{"diarista"},
		ExcludeUserIDs: []uint{3},
	})

	select {
	case request := <-hub.dispatch:
		hub.dispatchMessage(request)
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for dispatch")
	}

	assertReceivesEvent(t, clientA.send, "offer.created")
	assertReceivesEvent(t, clientB.send, "offer.created")
	assertNoEvent(t, clientC.send)
}

func TestClientReadPumpRespondsToPing(t *testing.T) {
	hub := NewHub()
	serverConn, clientConn := net.Pipe()
	defer clientConn.Close()

	unregisterDone := make(chan struct{})
	go func() {
		<-hub.unregister
		close(unregisterDone)
	}()

	client := &Client{
		hub:      hub,
		conn:     NewWSConn(serverConn),
		userID:   42,
		userRole: "diarista",
		send:     make(chan []byte, 2),
	}

	done := make(chan struct{})
	go func() {
		client.readPump()
		close(done)
	}()

	go func() {
		frame := maskedTextFrame([]byte(`{"type":"client.ping"}`))
		_, _ = clientConn.Write(frame)
	}()

	assertReceivesEvent(t, client.send, "system.pong")

	_ = clientConn.Close()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("readPump did not exit after client close")
	}

	select {
	case <-unregisterDone:
	case <-time.After(time.Second):
		t.Fatal("client was not unregistered")
	}
}

func assertReceivesEvent(t *testing.T, ch <-chan []byte, eventType string) {
	t.Helper()

	select {
	case raw := <-ch:
		var event OutboundEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			t.Fatalf("failed to decode event: %v", err)
		}
		if event.Type != eventType {
			t.Fatalf("unexpected event type: got %q want %q", event.Type, eventType)
		}
	case <-time.After(time.Second):
		t.Fatalf("expected event %q but channel was empty", eventType)
	}
}

func assertNoEvent(t *testing.T, ch <-chan []byte) {
	t.Helper()

	select {
	case raw := <-ch:
		t.Fatalf("unexpected event received: %s", string(raw))
	case <-time.After(150 * time.Millisecond):
	}
}

func maskedTextFrame(payload []byte) []byte {
	maskKey := []byte{0x01, 0x02, 0x03, 0x04}
	frame := []byte{0x81, 0x80 | byte(len(payload))}
	frame = append(frame, maskKey...)

	for index, value := range payload {
		frame = append(frame, value^maskKey[index%len(maskKey)])
	}

	return frame
}
