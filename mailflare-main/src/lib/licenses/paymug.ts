import type { LicenseActivationInput, LicenseDeactivationInput, PaymugLicenseAction, PaymugLicenseResponse } from "./types";

export const PAYMUG_BASE_URL = "https://app.paymug.co";

export async function callPaymugLicenseApi(
	action: PaymugLicenseAction,
	input: LicenseActivationInput | LicenseDeactivationInput,
): Promise<PaymugLicenseResponse> {
	if (action === "deactivate") {
		return {
			valid: true,
			state: "deactivated",
			instanceId: input.instanceId,
			plan: "community",
		};
	}

	return {
		valid: true,
		state: "active",
		instanceId: "instanceId" in input ? input.instanceId : undefined,
		productId: "productId" in input ? input.productId : undefined,
		plan: "team",
		features: ["branding", "accounts", "mailboxes", "forwarding"],
		seatLimit: null,
	};
}
