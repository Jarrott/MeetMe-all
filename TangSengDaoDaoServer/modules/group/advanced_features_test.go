package group

import (
	"os"
	"strings"
	"testing"
)

func TestGroupAdvancedFeatureRoutes(t *testing.T) {
	source := mustReadGroupTestFile(t, "api.go")

	assertContainsAll(t, source, []string{
		`groups.POST("/:group_no/managers", g.managerAdd)`,
		`groups.DELETE("/:group_no/managers", g.managerRemove)`,
		`groups.POST("/:group_no/forbidden/:on", g.groupForbidden)`,
		`groups.POST("/:group_no/forbidden_with_member", g.forbiddenWithGroupMember)`,
		`groups.POST("/:group_no/avatar", g.avatarUpload)`,
		`groups.POST("/:group_no/member/invite", g.groupMemberInviteAdd)`,
	})
}

func TestGroupAdvancedFeatureStorage(t *testing.T) {
	baseMigration := mustReadGroupTestFile(t, "sql/group_20191106-01.sql")
	memberMuteMigration := mustReadGroupTestFile(t, "sql/group_20211202-02.sql")
	avatarMigration := mustReadGroupTestFile(t, "sql/group_20220411-01.sql")
	avatarUploadFlagMigration := mustReadGroupTestFile(t, "sql/group_20220818-01.sql")
	memberPinnedMigration := mustReadGroupTestFile(t, "sql/group_20240510-01.sql")

	assertContainsAll(t, baseMigration, []string{
		"forbidden",
		"invite",
		"role",
		"`group_invite`",
		"`invite_item`",
	})
	assertContainsAll(t, memberMuteMigration, []string{"forbidden_expir_time"})
	assertContainsAll(t, avatarMigration, []string{"ADD COLUMN avatar"})
	assertContainsAll(t, avatarUploadFlagMigration, []string{"is_upload_avatar"})
	assertContainsAll(t, memberPinnedMigration, []string{"allow_member_pinned_message"})
}

func TestGroupAdvancedFeaturePermissionLogic(t *testing.T) {
	apiSource := mustReadGroupTestFile(t, "api.go")
	settingActionSource := mustReadGroupTestFile(t, "api_setting_action.go")
	inviteSource := mustReadGroupTestFile(t, "invite.go")

	assertContainsAll(t, apiSource, []string{
		"QueryIsGroupCreator(groupNo, loginUID)",
		"QueryIsGroupManagerOrCreator(groupNo, loginUID)",
		"resetIMWhitelist(whitelistUIDs, groupNo)",
		"UpdateMembersToManager(groupNo, memberUIDs, version)",
		"ForbiddenExpirTime",
	})
	assertContainsAll(t, settingActionSource, []string{
		"common.GroupAllowMemberPinnedMessage",
		"ctx.groupModel.AllowMemberPinnedMessage",
		"ctx.checkPermissions()",
	})
	assertContainsAll(t, inviteSource, []string{
		"event.GroupMemberInviteRequest",
		"InsertInviteTx",
		"InsertInviteItemTx",
		"GroupMemberInvite",
	})
}

func mustReadGroupTestFile(t *testing.T, path string) string {
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
