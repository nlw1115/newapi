package relay

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestLatestResponsesRequestTextUsesLatestUserMessage(t *testing.T) {
	request := responsesRequest(t, []map[string]any{
		{
			"role":    "user",
			"content": "old repeated conversation",
		},
		{
			"role":    "assistant",
			"content": "assistant reply",
		},
		{
			"type": "message",
			"role": "user",
			"content": []map[string]any{
				{"type": "input_text", "text": "current user request"},
			},
		},
	})

	if got := latestResponsesRequestText(request); got != "current user request" {
		t.Fatalf("latestResponsesRequestText() = %q", got)
	}
}

func TestNormalizeRequestSummaryStripsLeadingContextBlocks(t *testing.T) {
	text := strings.Join([]string{
		"<permissions instructions> Filesystem sandboxing enabled. </permissions instructions>",
		"<app-context> desktop context </app-context>",
		"<environment_context> cwd and shell </environment_context>",
		"real current user request",
	}, "\n")

	got := normalizeRequestSummary(text)
	if got != "real current user request" {
		t.Fatalf("normalizeRequestSummary() = %q", got)
	}
}

func TestLatestResponsesRequestTextFallsBackToLastTextInput(t *testing.T) {
	request := responsesRequest(t, []map[string]any{
		{
			"content": []map[string]any{
				{"type": "input_text", "text": "first input"},
			},
		},
		{
			"content": []map[string]any{
				{"type": "input_text", "text": "last input"},
			},
		},
	})

	if got := latestResponsesRequestText(request); got != "last input" {
		t.Fatalf("latestResponsesRequestText() = %q", got)
	}
}

func responsesRequest(t *testing.T, input any) *dto.OpenAIResponsesRequest {
	t.Helper()
	raw, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	return &dto.OpenAIResponsesRequest{Input: raw}
}
