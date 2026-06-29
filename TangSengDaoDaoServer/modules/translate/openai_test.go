package translate

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOpenAIClientTranslate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/responses" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Fatalf("unexpected authorization header: %s", r.Header.Get("Authorization"))
		}
		var req openAIResponseReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req.Model != "gpt-4o-mini" {
			t.Fatalf("unexpected model: %s", req.Model)
		}
		if len(req.Input) != 2 {
			t.Fatalf("unexpected input length: %d", len(req.Input))
		}
		_ = json.NewEncoder(w).Encode(map[string]string{
			"output_text": "Hello",
		})
	}))
	defer server.Close()

	t.Setenv("OPENAI_API_KEY", "test-key")
	t.Setenv("OPENAI_TRANSLATE_MODEL", "gpt-4o-mini")
	t.Setenv("OPENAI_BASE_URL", server.URL)

	client, err := newOpenAIClient()
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	got, err := client.translate("你好", "auto", "en")
	if err != nil {
		t.Fatalf("translate: %v", err)
	}
	if got != "Hello" {
		t.Fatalf("unexpected translation: %s", got)
	}
}

func TestHasTranslatableText(t *testing.T) {
	cases := []struct {
		name string
		text string
		want bool
	}{
		{name: "digits", text: "123456", want: false},
		{name: "decimal", text: "12.34", want: false},
		{name: "currency", text: "$100.00", want: false},
		{name: "emoji with digit", text: "👍1", want: false},
		{name: "chinese", text: "今天6点见", want: true},
		{name: "english", text: "hello 123", want: true},
		{name: "thai", text: "สวัสดี 123", want: true},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := hasTranslatableText(tt.text); got != tt.want {
				t.Fatalf("hasTranslatableText(%q) = %v, want %v", tt.text, got, tt.want)
			}
		})
	}
}
