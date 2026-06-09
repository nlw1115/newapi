package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestDollarQuotaOptionConversion(t *testing.T) {
	originalQuotaPerUnit := common.QuotaPerUnit
	t.Cleanup(func() {
		common.QuotaPerUnit = originalQuotaPerUnit
	})
	common.QuotaPerUnit = 500000

	require.True(t, isDollarQuotaOptionKey("QuotaForNewUser"))
	require.True(t, isDollarQuotaOptionKey("QuotaForInviter"))
	require.True(t, isDollarQuotaOptionKey("QuotaForInvitee"))
	require.True(t, isDollarQuotaOptionKey("checkin_setting.min_quota"))
	require.True(t, isDollarQuotaOptionKey("checkin_setting.max_quota"))
	require.False(t, isDollarQuotaOptionKey("PreConsumedQuota"))

	require.Equal(t, "1", internalQuotaToDollarString("500000"))
	require.Equal(t, "10", internalQuotaToDollarString("5000000"))
	require.Equal(t, "0.002", internalQuotaToDollarString("1000"))
	require.Equal(t, "2500000", dollarStringToInternalQuotaString("5"))
	require.Equal(t, "500000", dollarStringToInternalQuotaString("1"))
	require.Equal(t, "1000", dollarStringToInternalQuotaString("0.002"))
}

func TestDollarQuotaOptionConversionLeavesInvalidValues(t *testing.T) {
	originalQuotaPerUnit := common.QuotaPerUnit
	t.Cleanup(func() {
		common.QuotaPerUnit = originalQuotaPerUnit
	})

	common.QuotaPerUnit = 500000
	require.Equal(t, "not-a-number", internalQuotaToDollarString("not-a-number"))
	require.Equal(t, "not-a-number", dollarStringToInternalQuotaString("not-a-number"))

	common.QuotaPerUnit = 0
	require.Equal(t, "500000", internalQuotaToDollarString("500000"))
	require.Equal(t, "5", dollarStringToInternalQuotaString("5"))
}
