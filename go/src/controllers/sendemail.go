package controllers

import (
	"gopkg.in/gomail.v2"
	"os"
)


func SendUserDocuments(subject string,body string ) error {
	from := os.Getenv("EMAIL_FROM")
	to := os.Getenv("EMAIL_ALERT_TO")
	password := os.Getenv("EMAIL_PASSWORD")

	m := gomail.NewMessage()
	m.SetHeader("From", from)
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", body)

	   
	d := gomail.NewDialer("smtp.kinghost.net", 587, from, password)
	return d.DialAndSend(m)
}
