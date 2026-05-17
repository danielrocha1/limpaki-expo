package config

import (
	"os"
	"strings"
)

// ShouldMarkAsTestUser returns true only when the normalized email is listed in
// INTERNAL_TEST_USER_EMAILS (comma-separated). Clients cannot set is_test_user via API.
func ShouldMarkAsTestUser(normalizedEmail string) bool {
	csv := strings.TrimSpace(os.Getenv("INTERNAL_TEST_USER_EMAILS"))
	if csv == "" {
		return false
	}

	email := strings.ToLower(strings.TrimSpace(normalizedEmail))
	if email == "" {
		return false
	}

	for _, part := range strings.Split(csv, ",") {
		if strings.ToLower(strings.TrimSpace(part)) == email {
			return true
		}
	}
	return false
}
