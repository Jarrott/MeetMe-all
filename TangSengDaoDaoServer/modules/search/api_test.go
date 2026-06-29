package search

import (
	"testing"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/common"
)

func TestLocalMessageVisiblePersonConversationBothDirections(t *testing.T) {
	search := &Search{}
	loginUID := "user_a"
	peerUID := "user_b"
	fakeChannelID := common.GetFakeChannelIDWith(loginUID, peerUID)
	req := &globalSearchReq{
		ChannelID:   peerUID,
		ChannelType: common.ChannelTypePerson.Uint8(),
	}

	if !search.localMessageVisible(loginUID, req, &localSearchMessage{
		FromUID:     loginUID,
		ChannelID:   peerUID,
		ChannelType: common.ChannelTypePerson.Uint8(),
	}, nil) {
		t.Fatal("sent direct message should be visible in the peer conversation")
	}

	if !search.localMessageVisible(loginUID, req, &localSearchMessage{
		FromUID:     peerUID,
		ChannelID:   loginUID,
		ChannelType: common.ChannelTypePerson.Uint8(),
	}, nil) {
		t.Fatal("received direct message should be visible in the peer conversation")
	}

	if !search.localMessageVisible(loginUID, req, &localSearchMessage{
		FromUID:     loginUID,
		ChannelID:   fakeChannelID,
		ChannelType: common.ChannelTypePerson.Uint8(),
	}, nil) {
		t.Fatal("fake-channel direct message should be visible in the peer conversation")
	}

	if search.localMessageVisible(loginUID, req, &localSearchMessage{
		FromUID:     peerUID,
		ChannelID:   "user_c",
		ChannelType: common.ChannelTypePerson.Uint8(),
	}, nil) {
		t.Fatal("message outside the login user's direct conversation should not be visible")
	}
}

func TestSearchChannelIDConvertsPersonChannelToFakeChannel(t *testing.T) {
	search := &Search{}
	loginUID := "user_a"
	peerUID := "user_b"
	req := &globalSearchReq{
		ChannelID:   peerUID,
		ChannelType: common.ChannelTypePerson.Uint8(),
	}

	if got, want := search.searchChannelID(loginUID, req), common.GetFakeChannelIDWith(loginUID, peerUID); got != want {
		t.Fatalf("expected fake channel id %q, got %q", want, got)
	}
}

func TestLocalSearchMessageToMessageRespNormalizesPersonChannel(t *testing.T) {
	loginUID := "user_a"
	peerUID := "user_b"
	msg := (&localSearchMessage{
		MessageID:   "123",
		FromUID:     peerUID,
		ChannelID:   loginUID,
		ChannelType: common.ChannelTypePerson.Uint8(),
	}).toMessageResp(loginUID)

	if msg.ChannelID != peerUID {
		t.Fatalf("expected received direct message channel to be normalized to peer uid %q, got %q", peerUID, msg.ChannelID)
	}
}

func TestLocalSearchMessageToMessageRespNormalizesFakeChannel(t *testing.T) {
	loginUID := "user_a"
	peerUID := "user_b"
	msg := (&localSearchMessage{
		MessageID:   "123",
		FromUID:     loginUID,
		ChannelID:   common.GetFakeChannelIDWith(loginUID, peerUID),
		ChannelType: common.ChannelTypePerson.Uint8(),
	}).toMessageResp(loginUID)

	if msg.ChannelID != peerUID {
		t.Fatalf("expected fake direct message channel to be normalized to peer uid %q, got %q", peerUID, msg.ChannelID)
	}
}
