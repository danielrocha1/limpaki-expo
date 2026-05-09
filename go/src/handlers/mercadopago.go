package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const mercadoPagoAPIBase = "https://api.mercadopago.com"

// Funcoes injetaveis para testes.
var (
	createMercadoPagoPreferenceFunc = createMercadoPagoPreferenceHTTP
	getMercadoPagoPaymentFunc       = getMercadoPagoPaymentHTTP
	getMercadoPagoPreapprovalFunc   = getMercadoPagoPreapprovalHTTP
)

func getMercadoPagoAccessToken() string {
	return strings.TrimSpace(os.Getenv("MERCADO_PAGO_ACCESS_TOKEN"))
}

func mercadoPagoConfigured() bool {
	return getMercadoPagoAccessToken() != ""
}

type mpPreferenceItem struct {
	Title      string  `json:"title"`
	Quantity   int     `json:"quantity"`
	UnitPrice  float64 `json:"unit_price"`
	CurrencyID string  `json:"currency_id"`
}

type mpPayer struct {
	Email string `json:"email,omitempty"`
}

type mpBackURLs struct {
	Success string `json:"success"`
	Failure string `json:"failure"`
	Pending string `json:"pending"`
}

type mpPreferenceRequest struct {
	Items             []mpPreferenceItem `json:"items"`
	Payer             mpPayer            `json:"payer"`
	BackURLs          mpBackURLs         `json:"back_urls"`
	AutoReturn        string             `json:"auto_return"`
	ExternalReference string             `json:"external_reference"`
	NotificationURL   string             `json:"notification_url,omitempty"`
	Metadata          map[string]string  `json:"metadata,omitempty"`
}

type mpPreferenceResponse struct {
	ID               string `json:"id"`
	InitPoint        string `json:"init_point"`
	SandboxInitPoint string `json:"sandbox_init_point"`
}

type mpPayerDetail struct {
	ID json.RawMessage `json:"id"`
}

type mpPaymentResponse struct {
	ID                  json.RawMessage `json:"id"`
	Status              string          `json:"status"`
	StatusDetail        string          `json:"status_detail"`
	ExternalReference   string          `json:"external_reference"`
	DateApproved        *string         `json:"date_approved"`
	Payer               *mpPayerDetail  `json:"payer"`
	TransactionAmount   float64         `json:"transaction_amount"`
	CurrencyID          string          `json:"currency_id"`
	DateCreated         *string         `json:"date_created"`
	ClientID            json.RawMessage `json:"client_id"`
	AdditionalInfo      string          `json:"additional_info"`
}

func (p *mpPaymentResponse) PaymentIDString() string {
	return strings.TrimSpace(strings.Trim(string(p.ID), `"`))
}

func payerIDString(p *mpPayerDetail) string {
	if p == nil {
		return ""
	}
	s := strings.TrimSpace(strings.Trim(string(p.ID), `"`))
	if s != "" {
		return s
	}
	return ""
}

var mercadoPagoHTTPClient = &http.Client{Timeout: 45 * time.Second}

func createMercadoPagoPreferenceHTTP(accessToken string, body mpPreferenceRequest) (*mpPreferenceResponse, error) {
	if strings.TrimSpace(accessToken) == "" {
		return nil, errors.New("MERCADO_PAGO_ACCESS_TOKEN nao configurada")
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, mercadoPagoAPIBase+"/checkout/preferences", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := mercadoPagoHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	rawBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("mercado pago preferences http %d: %s", resp.StatusCode, strings.TrimSpace(string(rawBody)))
	}
	var out mpPreferenceResponse
	if err := json.Unmarshal(rawBody, &out); err != nil {
		return nil, err
	}
	if out.ID == "" {
		return nil, errors.New("resposta do Mercado Pago sem id de preferencia")
	}
	return &out, nil
}

type mpPreapprovalResponse struct {
	ID                  json.RawMessage `json:"id"`
	Status              string          `json:"status"`
	ExternalReference   string          `json:"external_reference"`
	PayerID             json.RawMessage `json:"payer_id"`
	Reason              string          `json:"reason"`
	LastModified        *string         `json:"last_modified"`
	DateCreated         *string         `json:"date_created"`
}

func (p *mpPreapprovalResponse) PreapprovalIDString() string {
	return strings.TrimSpace(strings.Trim(string(p.ID), `"`))
}

func payerIDFromRaw(raw json.RawMessage) string {
	s := strings.TrimSpace(string(raw))
	if s == "" || s == "null" {
		return ""
	}
	if strings.HasPrefix(s, "\"") {
		var str string
		if err := json.Unmarshal(raw, &str); err == nil {
			return strings.TrimSpace(str)
		}
	}
	var num float64
	if err := json.Unmarshal(raw, &num); err == nil && num > 0 {
		return strconv.FormatInt(int64(num), 10)
	}
	return strings.Trim(s, `"`)
}

func getMercadoPagoPreapprovalHTTP(accessToken string, preapprovalID string) (*mpPreapprovalResponse, error) {
	if strings.TrimSpace(accessToken) == "" {
		return nil, errors.New("MERCADO_PAGO_ACCESS_TOKEN nao configurada")
	}
	pid := strings.TrimSpace(preapprovalID)
	if pid == "" {
		return nil, errors.New("preapproval id vazio")
	}
	req, err := http.NewRequest(http.MethodGet, mercadoPagoAPIBase+"/preapproval/"+pid, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	resp, err := mercadoPagoHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	rawBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("mercado pago preapproval http %d: %s", resp.StatusCode, strings.TrimSpace(string(rawBody)))
	}
	var out mpPreapprovalResponse
	if err := json.Unmarshal(rawBody, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func getMercadoPagoPaymentHTTP(accessToken string, paymentID string) (*mpPaymentResponse, error) {
	if strings.TrimSpace(accessToken) == "" {
		return nil, errors.New("MERCADO_PAGO_ACCESS_TOKEN nao configurada")
	}
	pid := strings.TrimSpace(paymentID)
	if pid == "" {
		return nil, errors.New("payment id vazio")
	}
	req, err := http.NewRequest(http.MethodGet, mercadoPagoAPIBase+"/v1/payments/"+pid, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	resp, err := mercadoPagoHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	rawBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("mercado pago payment http %d: %s", resp.StatusCode, strings.TrimSpace(string(rawBody)))
	}
	var out mpPaymentResponse
	if err := json.Unmarshal(rawBody, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func parsePaymentIDFromRaw(raw json.RawMessage) (string, error) {
	s := strings.TrimSpace(string(raw))
	if s == "" || s == "null" {
		return "", errors.New("id ausente")
	}
	if strings.HasPrefix(s, "\"") {
		var str string
		if err := json.Unmarshal(raw, &str); err != nil {
			return "", err
		}
		return strings.TrimSpace(str), nil
	}
	var num float64
	if err := json.Unmarshal(raw, &num); err == nil && num > 0 {
		return strconv.FormatInt(int64(num), 10), nil
	}
	return "", errors.New("id de pagamento invalido")
}

// Corpo tipico de webhook Mercado Pago (payment).
type mercadoPagoWebhookNotification struct {
	ID       json.RawMessage `json:"id"`
	LiveMode bool            `json:"live_mode"`
	Type     string          `json:"type"`
	Action   string          `json:"action"`
	Data     struct {
		ID json.RawMessage `json:"id"`
	} `json:"data"`
}
