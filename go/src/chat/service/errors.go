package service

import "errors"

var (
	ErrForbidden       = errors.New("forbidden")
	ErrInvalidInput    = errors.New("invalid input")
	ErrRateLimited     = errors.New("rate limited")
	ErrNoRoomsSelected = errors.New("at least one room is required")
	ErrChatUnavailable = errors.New("chat unavailable for this service")
)
