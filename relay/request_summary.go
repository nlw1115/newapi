package relay

import (
	"encoding/json"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"

	"github.com/gin-gonic/gin"
)

const requestSummaryMaxRunes = 240

func setOpenAIRequestSummary(c *gin.Context, request *dto.GeneralOpenAIRequest) {
	if request == nil {
		return
	}
	var texts []string

	for i := len(request.Messages) - 1; i >= 0; i-- {
		message := request.Messages[i]
		if message.Role != "user" {
			continue
		}
		if text := message.StringContent(); text != "" {
			texts = append(texts, text)
			break
		}
	}

	if len(texts) == 0 {
		for i := len(request.Messages) - 1; i >= 0; i-- {
			if text := request.Messages[i].StringContent(); text != "" {
				texts = append(texts, text)
				break
			}
		}
	}

	if len(texts) == 0 && request.Prompt != nil {
		texts = append(texts, valueToSummaryText(request.Prompt))
	}
	if len(texts) == 0 && request.Input != nil {
		texts = append(texts, strings.Join(request.ParseInput(), " "))
	}

	setRequestSummary(c, strings.Join(texts, " "))
}

func setResponsesRequestSummary(c *gin.Context, request *dto.OpenAIResponsesRequest) {
	if request == nil {
		return
	}
	if text := latestResponsesRequestText(request); text != "" {
		setRequestSummary(c, text)
		return
	}

	inputs := request.ParseInput()
	for i := len(inputs) - 1; i >= 0; i-- {
		if inputs[i].Type == "input_text" && inputs[i].Text != "" {
			setRequestSummary(c, inputs[i].Text)
			return
		}
	}
}

func setClaudeRequestSummary(c *gin.Context, request *dto.ClaudeRequest) {
	if request == nil {
		return
	}
	for i := len(request.Messages) - 1; i >= 0; i-- {
		message := request.Messages[i]
		if message.Role != "user" {
			continue
		}
		if text := claudeMessageText(message); text != "" {
			setRequestSummary(c, text)
			return
		}
	}
	if request.Prompt != "" {
		setRequestSummary(c, request.Prompt)
	}
}

func setRequestSummary(c *gin.Context, text string) {
	summary := normalizeRequestSummary(text)
	if summary == "" {
		return
	}
	common.SetContextKey(c, constant.ContextKeyRequestSummary, summary)
}

func normalizeRequestSummary(text string) string {
	text = stripKnownLeadingContextBlocks(text)
	text = strings.Join(strings.Fields(text), " ")
	if text == "" {
		return ""
	}
	if utf8.RuneCountInString(text) <= requestSummaryMaxRunes {
		return text
	}
	runes := []rune(text)
	return string(runes[:requestSummaryMaxRunes]) + "..."
}

type responsesSummaryInput struct {
	Type    string          `json:"type,omitempty"`
	Role    string          `json:"role,omitempty"`
	Text    string          `json:"text,omitempty"`
	Content json.RawMessage `json:"content,omitempty"`
}

func latestResponsesRequestText(request *dto.OpenAIResponsesRequest) string {
	if request == nil || len(request.Input) == 0 {
		return ""
	}

	var text string
	if err := json.Unmarshal(request.Input, &text); err == nil {
		return text
	}

	var inputs []responsesSummaryInput
	if err := json.Unmarshal(request.Input, &inputs); err == nil {
		if text := latestResponsesInputText(inputs, true); text != "" {
			return text
		}
		return latestResponsesInputText(inputs, false)
	}

	var input responsesSummaryInput
	if err := json.Unmarshal(request.Input, &input); err == nil {
		return responsesInputText(input)
	}

	return ""
}

func latestResponsesInputText(inputs []responsesSummaryInput, userOnly bool) string {
	for i := len(inputs) - 1; i >= 0; i-- {
		role := strings.ToLower(inputs[i].Role)
		if userOnly && role != "user" {
			continue
		}
		if !userOnly && role == "assistant" {
			continue
		}
		if text := responsesInputText(inputs[i]); text != "" {
			return text
		}
	}
	return ""
}

func responsesInputText(input responsesSummaryInput) string {
	if input.Text != "" {
		return input.Text
	}
	if len(input.Content) == 0 {
		return ""
	}

	var text string
	if err := json.Unmarshal(input.Content, &text); err == nil {
		return text
	}

	var parts []responsesSummaryInput
	if err := json.Unmarshal(input.Content, &parts); err == nil {
		texts := make([]string, 0, len(parts))
		for _, part := range parts {
			if part.Type != "" && part.Type != "input_text" && part.Type != "text" {
				continue
			}
			if part.Text != "" {
				texts = append(texts, part.Text)
			}
		}
		return strings.Join(texts, " ")
	}

	return ""
}

var knownLeadingContextTags = []string{
	"permissions instructions",
	"app-context",
	"collaboration_mode",
	"skills_instructions",
	"plugins_instructions",
	"environment_context",
	"turn_aborted",
}

func stripKnownLeadingContextBlocks(text string) string {
	text = stripCodexLeadingEnvironment(text)
	for {
		trimmed := strings.TrimSpace(text)
		lower := strings.ToLower(trimmed)
		changed := false

		for _, tag := range knownLeadingContextTags {
			openTag := "<" + tag + ">"
			closeTag := "</" + tag + ">"
			if !strings.HasPrefix(lower, openTag) {
				continue
			}
			closeIdx := strings.Index(lower, closeTag)
			if closeIdx < 0 {
				continue
			}
			text = strings.TrimSpace(trimmed[closeIdx+len(closeTag):])
			changed = true
			break
		}

		if !changed {
			return trimmed
		}
	}
}

func stripCodexLeadingEnvironment(text string) string {
	trimmed := strings.TrimSpace(text)
	lower := strings.ToLower(trimmed)
	if !strings.HasPrefix(lower, "<permissions instructions>") {
		return trimmed
	}

	closeTag := "</environment_context>"
	closeIdx := strings.LastIndex(lower, closeTag)
	if closeIdx < 0 {
		return trimmed
	}
	return strings.TrimSpace(trimmed[closeIdx+len(closeTag):])
}

func valueToSummaryText(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case []any:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			if text, ok := item.(string); ok {
				parts = append(parts, text)
			}
		}
		if len(parts) > 0 {
			return strings.Join(parts, " ")
		}
	}
	return fmt.Sprintf("%v", value)
}

func claudeMessageText(message dto.ClaudeMessage) string {
	if text := message.GetStringContent(); text != "" {
		return text
	}
	contents, _ := message.ParseContent()
	parts := make([]string, 0, len(contents))
	for _, content := range contents {
		if content.Type == dto.ContentTypeText && content.GetText() != "" {
			parts = append(parts, content.GetText())
		}
	}
	return strings.Join(parts, " ")
}
