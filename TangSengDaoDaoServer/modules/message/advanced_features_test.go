package message

import (
	"os"
	"strings"
	"testing"
)

func TestMessageAdvancedFeatureRoutes(t *testing.T) {
	apiSource := mustReadMessageTestFile(t, "api.go")

	assertContainsAll(t, apiSource, []string{
		`message.POST("/pinned", m.pinnedMessage)`,
		`message.POST("/pinned/sync", m.syncPinnedMessage)`,
		`message.POST("/pinned/clear", m.clearPinnedMessage)`,
		`reactions.POST("", m.addOrCancelReaction)`,
		`reaction.POST("/sync", m.syncReaction)`,
	})
}

func TestMessageAdvancedFeatureStorage(t *testing.T) {
	reactionMigration := mustReadMessageTestFile(t, "sql/message-20210416-01.sql")
	pinnedMigration := mustReadMessageTestFile(t, "sql/message-20240510-01.sql")
	commonPinnedMigration := mustReadMessageTestFile(t, "../common/sql/common-20240510-01.sql")

	assertContainsAll(t, reactionMigration, []string{
		"`reaction_users`",
		"message_id",
		"emoji",
		"is_deleted",
	})
	assertContainsAll(t, pinnedMigration, []string{
		"`pinned_message`",
		"message_seq",
		"is_deleted",
		"is_pinned",
	})
	assertContainsAll(t, commonPinnedMigration, []string{"channel_pinned_message_max_count"})
}

func TestMessageAdvancedFeatureBehaviorHooks(t *testing.T) {
	apiSource := mustReadMessageTestFile(t, "api.go")
	pinnedSource := mustReadMessageTestFile(t, "api_pinned.go")

	assertContainsAll(t, apiSource, []string{
		"queryReactionWithUIDAndMessageID",
		"insertReaction",
		"updateReactionStatus",
		"common.CMDSyncMessageReaction",
		"Reactions",
		"[]*reactionSimpleResp",
	})
	assertContainsAll(t, pinnedSource, []string{
		"AllowMemberPinnedMessage",
		"ChannelPinnedMessageMaxCount",
		"insertOrUpdatePinnedTx",
		"common.CMDSyncPinnedMessage",
		"普通成员不允许置顶消息",
		"用户无权清空置顶消息",
	})
}

func mustReadMessageTestFile(t *testing.T, path string) string {
	t.Helper()

	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(content)
}

func assertContainsAll(t *testing.T, content string, wants []string) {
	t.Helper()

	for _, want := range wants {
		if !strings.Contains(content, want) {
			t.Fatalf("expected content to contain %q", want)
		}
	}
}
