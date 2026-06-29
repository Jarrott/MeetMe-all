package translate

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const defaultTranslateModel = "gpt-4o-mini"

type openAIClient struct {
	apiKey     string
	model      string
	endpoint   string
	httpClient *http.Client
}

func newOpenAIClient() (*openAIClient, error) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		return nil, errors.New("OPENAI_API_KEY未配置")
	}
	model := strings.TrimSpace(os.Getenv("OPENAI_TRANSLATE_MODEL"))
	if model == "" {
		model = defaultTranslateModel
	}
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("OPENAI_BASE_URL")), "/")
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	return &openAIClient{
		apiKey:   apiKey,
		model:    model,
		endpoint: baseURL + "/responses",
		httpClient: &http.Client{
			Timeout: 25 * time.Second,
		},
	}, nil
}

func translateModelName() string {
	model := strings.TrimSpace(os.Getenv("OPENAI_TRANSLATE_MODEL"))
	if model == "" {
		return defaultTranslateModel
	}
	return model
}

func (o *openAIClient) translate(text string, sourceLang string, targetLang string) (string, error) {
	payload := openAIResponseReq{
		Model: o.model,
		Input: []openAIInputMessage{
			{
				Role:    "system",
				Content: "You are a chat translation engine. Translate the user's message into the target language. Preserve names, mentions, URLs, emojis, and line breaks. Return only the translated text without explanations.",
			},
			{
				Role: "user",
				Content: fmt.Sprintf(
					"Source language: %s\nTarget language: %s\nText:\n%s",
					sourceLang,
					targetLang,
					text,
				),
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodPost, o.endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+o.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		var errResp openAIErrorResp
		if json.Unmarshal(respBody, &errResp) == nil && errResp.Error.Message != "" {
			return "", errors.New(errResp.Error.Message)
		}
		return "", fmt.Errorf("OpenAI翻译失败：HTTP %d", resp.StatusCode)
	}
	var result openAIResponseResp
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", err
	}
	translated := strings.TrimSpace(result.OutputText)
	if translated != "" {
		return translated, nil
	}
	for _, output := range result.Output {
		for _, content := range output.Content {
			if strings.TrimSpace(content.Text) != "" {
				return strings.TrimSpace(content.Text), nil
			}
		}
	}
	return "", errors.New("OpenAI未返回翻译内容")
}

type openAIResponseReq struct {
	Model string               `json:"model"`
	Input []openAIInputMessage `json:"input"`
}

type openAIInputMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponseResp struct {
	OutputText string `json:"output_text"`
	Output     []struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	} `json:"output"`
}

type openAIErrorResp struct {
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}
