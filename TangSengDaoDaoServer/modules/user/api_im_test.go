package user

import "testing"

func TestNormalizeIMRouteAddrsSetsWSSFromSecureWS(t *testing.T) {
	resultMap := map[string]interface{}{
		"tcp_addr": "127.0.0.1:5100",
		"ws_addr":  "wss://ws.meetme.im",
	}

	normalizeIMRouteAddrs(resultMap)

	if resultMap["wss_addr"] != "wss://ws.meetme.im" {
		t.Fatalf("expected wss_addr to mirror secure ws_addr, got %v", resultMap["wss_addr"])
	}
	if resultMap["ws_addr"] != "wss://ws.meetme.im" {
		t.Fatalf("expected ws_addr to stay unchanged, got %v", resultMap["ws_addr"])
	}
}

func TestNormalizeIMRouteAddrsSetsWSFromWSSWhenMissing(t *testing.T) {
	resultMap := map[string]interface{}{
		"tcp_addr": "127.0.0.1:5100",
		"wss_addr": "wss://ws.meetme.im",
	}

	normalizeIMRouteAddrs(resultMap)

	if resultMap["ws_addr"] != "wss://ws.meetme.im" {
		t.Fatalf("expected ws_addr to mirror wss_addr, got %v", resultMap["ws_addr"])
	}
}

func TestNormalizeIMRouteAddrsKeepsPlainWS(t *testing.T) {
	resultMap := map[string]interface{}{
		"ws_addr":  "ws://127.0.0.1:5200",
		"wss_addr": "wss://ws.meetme.im",
	}

	normalizeIMRouteAddrs(resultMap)

	if resultMap["ws_addr"] != "ws://127.0.0.1:5200" {
		t.Fatalf("expected plain ws_addr to stay unchanged, got %v", resultMap["ws_addr"])
	}
	if resultMap["wss_addr"] != "wss://ws.meetme.im" {
		t.Fatalf("expected wss_addr to stay unchanged, got %v", resultMap["wss_addr"])
	}
}
