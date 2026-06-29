package common

import "testing"

func TestNormalizeSMSPhone(t *testing.T) {
	tests := []struct {
		name  string
		zone  string
		phone string
		want  string
	}{
		{
			name:  "china",
			zone:  "0086",
			phone: "17000000000",
			want:  "17000000000",
		},
		{
			name:  "thailand local trunk with plus zone",
			zone:  "+66",
			phone: "0812345678",
			want:  "66812345678",
		},
		{
			name:  "thailand local trunk with 00 zone",
			zone:  "0066",
			phone: "081-234-5678",
			want:  "66812345678",
		},
		{
			name:  "already international without plus",
			zone:  "+66",
			phone: "66812345678",
			want:  "66812345678",
		},
		{
			name:  "already international with plus",
			zone:  "+66",
			phone: "+66 81 234 5678",
			want:  "66812345678",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeSMSPhone(tt.zone, tt.phone); got != tt.want {
				t.Fatalf("normalizeSMSPhone(%q, %q) = %q, want %q", tt.zone, tt.phone, got, tt.want)
			}
		})
	}
}
