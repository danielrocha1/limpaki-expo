package config

import (
	"os"
	"testing"
)

func TestShouldMarkAsTestUser(t *testing.T) {
	t.Setenv("INTERNAL_TEST_USER_EMAILS", "qa@limpae.app, dev@example.com")

	if !ShouldMarkAsTestUser("qa@limpae.app") {
		t.Fatal("expected allowlisted email to be test user")
	}
	if !ShouldMarkAsTestUser("  DEV@example.com  ") {
		t.Fatal("expected trimmed case-insensitive match")
	}
	if ShouldMarkAsTestUser("other@example.com") {
		t.Fatal("expected non-allowlisted email to be false")
	}
}

func TestShouldMarkAsTestUserEmptyEnv(t *testing.T) {
	os.Unsetenv("INTERNAL_TEST_USER_EMAILS")
	if ShouldMarkAsTestUser("qa@limpae.app") {
		t.Fatal("expected false when env is unset")
	}
}
