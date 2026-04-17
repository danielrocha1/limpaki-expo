package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const defaultSupabaseBucket = "uploads"
const defaultSignedURLTTLSeconds = 3600

type supabaseStorageObject struct {
	Key string `json:"Key"`
}

type supabaseSignedURLResponse struct {
	SignedURL string `json:"signedURL"`
}

func getSupabaseConfig() (baseURL string, serviceKey string, bucketName string, err error) {
	baseURL = strings.TrimRight(os.Getenv("SUPABASE_URL"), "/")
	serviceKey = strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_ROLE_KEY"))
	if serviceKey == "" {
		serviceKey = strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_KEY"))
	}
	if serviceKey == "" {
		serviceKey = strings.TrimSpace(os.Getenv("SUPABASE_KEY"))
	}
	if serviceKey == "" {
		serviceKey = strings.TrimSpace(os.Getenv("SUPABASE_ANON_KEY"))
	}

	bucketName = strings.TrimSpace(os.Getenv("SUPABASE_STORAGE_BUCKET"))
	if bucketName == "" {
		bucketName = strings.TrimSpace(os.Getenv("SUPABASE_BUCKET"))
	}
	if bucketName == "" {
		bucketName = defaultSupabaseBucket
	}

	if baseURL == "" {
		return "", "", "", fmt.Errorf("SUPABASE_URL nao configurada")
	}

	if serviceKey == "" {
		return "", "", "", fmt.Errorf("SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SERVICE_KEY, SUPABASE_KEY ou SUPABASE_ANON_KEY nao configurada")
	}

	return baseURL, serviceKey, bucketName, nil
}

func DetectImageExtension(fileHeader *multipart.FileHeader) string {
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return ext
	default:
		return ""
	}
}

func BuildUserPhotoPath(userID uint, extension string) string {
	cleanExtension := strings.ToLower(strings.TrimSpace(extension))
	if cleanExtension == "" {
		cleanExtension = ".jpg"
	}
	if !strings.HasPrefix(cleanExtension, ".") {
		cleanExtension = "." + cleanExtension
	}

	return fmt.Sprintf("users/%d/profile%s", userID, cleanExtension)
}

func IsExternalURL(value string) bool {
	normalizedValue := strings.ToLower(strings.TrimSpace(value))
	return strings.HasPrefix(normalizedValue, "http://") || strings.HasPrefix(normalizedValue, "https://")
}

func UploadFileToSupabase(file io.Reader, objectPath string, contentType string) (string, error) {
	baseURL, serviceKey, bucketName, err := getSupabaseConfig()
	if err != nil {
		return "", err
	}

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("erro ao ler arquivo para upload: %w", err)
	}

	normalizedObjectPath := strings.TrimLeft(objectPath, "/")
	endpoint := fmt.Sprintf("%s/storage/v1/object/%s/%s", baseURL, bucketName, normalizedObjectPath)

	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(fileBytes))
	if err != nil {
		return "", fmt.Errorf("erro ao criar requisicao para o Supabase: %w", err)
	}

	if strings.TrimSpace(contentType) == "" {
		contentType = "application/octet-stream"
	}

	req.Header.Set("Authorization", "Bearer "+serviceKey)
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "true")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("erro ao enviar arquivo para o Supabase: %w", err)
	}
	defer resp.Body.Close()

	responseBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("erro ao fazer upload para o Supabase: status %d - %s", resp.StatusCode, strings.TrimSpace(string(responseBody)))
	}

	if len(responseBody) > 0 {
		var uploadResponse supabaseStorageObject
		if err := json.Unmarshal(responseBody, &uploadResponse); err == nil && strings.TrimSpace(uploadResponse.Key) != "" {
			objectPath = uploadResponse.Key
		} else {
			objectPath = normalizedObjectPath
		}
	}

	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", baseURL, bucketName, strings.TrimLeft(objectPath, "/"))

	return publicURL, nil
}

func CreateSignedUploadURL(objectPath string, expiresInSeconds int) (string, error) {
	baseURL, serviceKey, bucketName, err := getSupabaseConfig()
	if err != nil {
		return "", err
	}

	return createSignedUploadURLWithBucket(baseURL, serviceKey, bucketName, objectPath, expiresInSeconds)
}

func createSignedUploadURLWithBucket(baseURL string, serviceKey string, bucketName string, objectPath string, expiresInSeconds int) (string, error) {
	if expiresInSeconds <= 0 {
		expiresInSeconds = defaultSignedURLTTLSeconds
	}

	normalizedObjectPath := normalizeSupabaseObjectPath(bucketName, objectPath)
	endpoint := fmt.Sprintf("%s/storage/v1/object/sign/%s/%s", baseURL, bucketName, normalizedObjectPath)

	requestBody, err := json.Marshal(map[string]int{
		"expiresIn": expiresInSeconds,
	})
	if err != nil {
		return "", fmt.Errorf("erro ao serializar payload da signed url: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(requestBody))
	if err != nil {
		return "", fmt.Errorf("erro ao criar requisicao de signed url: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+serviceKey)
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("erro ao solicitar signed url ao Supabase: %w", err)
	}
	defer resp.Body.Close()

	responseBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("erro ao gerar signed url no Supabase: status %d - %s", resp.StatusCode, strings.TrimSpace(string(responseBody)))
	}

	var signedResponse supabaseSignedURLResponse
	if err := json.Unmarshal(responseBody, &signedResponse); err != nil {
		return "", fmt.Errorf("erro ao ler resposta de signed url: %w", err)
	}

	if strings.TrimSpace(signedResponse.SignedURL) == "" {
		return "", fmt.Errorf("signed url nao retornada pelo Supabase")
	}

	if IsExternalURL(signedResponse.SignedURL) {
		return signedResponse.SignedURL, nil
	}

	normalizedSignedURL := strings.TrimSpace(signedResponse.SignedURL)
	if strings.HasPrefix(normalizedSignedURL, "/storage/v1/") {
		return fmt.Sprintf("%s%s", baseURL, normalizedSignedURL), nil
	}

	if strings.HasPrefix(normalizedSignedURL, "/object/") {
		return fmt.Sprintf("%s/storage/v1%s", baseURL, normalizedSignedURL), nil
	}

	return fmt.Sprintf("%s/storage/v1/%s", baseURL, strings.TrimLeft(normalizedSignedURL, "/")), nil
}

func ResolveStoredPhotoURL(storedValue string) (string, error) {
	normalizedValue := strings.TrimSpace(storedValue)
	if normalizedValue == "" {
		return "", nil
	}

	if IsExternalURL(normalizedValue) {
		baseURL, serviceKey, configuredBucket, err := getSupabaseConfig()
		if err == nil {
			if bucketName, objectPath, ok := extractSupabaseObjectInfo(baseURL, normalizedValue); ok {
				bucketCandidates := []string{bucketName}
				if configuredBucket != "" && configuredBucket != bucketName {
					bucketCandidates = append(bucketCandidates, configuredBucket)
				}

				for _, candidateBucket := range bucketCandidates {
					signedURL, signErr := createSignedUploadURLWithBucket(
						baseURL,
						serviceKey,
						candidateBucket,
						objectPath,
						defaultSignedURLTTLSeconds,
					)
					if signErr == nil {
						return signedURL, nil
					}
					err = signErr
				}
			}
		}

		if err != nil {
			return "", err
		}

		return normalizedValue, nil
	}

	return CreateSignedUploadURL(normalizedValue, defaultSignedURLTTLSeconds)
}

func extractSupabaseObjectInfo(baseURL string, rawURL string) (bucketName string, objectPath string, ok bool) {
	normalizedBaseURL := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	normalizedRawURL := strings.TrimSpace(rawURL)
	if normalizedBaseURL == "" || normalizedRawURL == "" || !strings.HasPrefix(normalizedRawURL, normalizedBaseURL) {
		return "", "", false
	}

	parsedURL, err := url.Parse(normalizedRawURL)
	if err != nil {
		return "", "", false
	}

	pathParts := strings.Split(strings.Trim(parsedURL.Path, "/"), "/")
	if len(pathParts) < 6 {
		return "", "", false
	}

	if pathParts[0] != "storage" || pathParts[1] != "v1" || pathParts[2] != "object" {
		return "", "", false
	}

	mode := pathParts[3]
	switch mode {
	case "public", "sign":
	default:
		return "", "", false
	}

	bucketName = pathParts[4]
	objectPath = normalizeSupabaseObjectPath(bucketName, strings.Join(pathParts[5:], "/"))
	if bucketName == "" || objectPath == "" {
		return "", "", false
	}

	return bucketName, objectPath, true
}

func normalizeSupabaseObjectPath(bucketName string, objectPath string) string {
	normalizedBucket := strings.Trim(strings.TrimSpace(bucketName), "/")
	normalizedPath := strings.Trim(strings.TrimSpace(objectPath), "/")

	if normalizedBucket == "" {
		return normalizedPath
	}

	bucketPrefix := normalizedBucket + "/"
	for strings.HasPrefix(normalizedPath, bucketPrefix) {
		normalizedPath = strings.TrimPrefix(normalizedPath, bucketPrefix)
	}

	return normalizedPath
}
