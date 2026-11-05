import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { licenseSettings } from "@/db/schema";
import type { LicenseEntitlements, LicensePlan, LicenseStatus, PaymugLicenseAction } from "./types";
import { hashLicenseKey, parseFeatures } from "./utils";

const LICENSE_SETTINGS_ID = "default";

async function getOrCreateLicenseSettings(env: CloudflareEnv) {
	const db = getDb(env);
	const now = new Date();
	await db
		.insert(licenseSettings)
		.values({
			id: LICENSE_SETTINGS_ID,
			instanceId: crypto.randomUUID(),
			plan: "team",
			state: "active",
			seatLimit: null,
			features: JSON.stringify(["branding", "accounts", "mailboxes", "forwarding"]),
			activatedAt: now,
			validatedAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing({ target: licenseSettings.id });
	const [settings] = await db
		.select()
		.from(licenseSettings)
		.where(eq(licenseSettings.id, LICENSE_SETTINGS_ID))
		.limit(1);
	if (!settings) throw new Error("Unable to initialize license settings");

	if (settings.plan === "community" && settings.state !== "active") {
		await db
			.update(licenseSettings)
			.set({
				plan: "team",
				state: "active",
				seatLimit: null,
				features: JSON.stringify(["branding", "accounts", "mailboxes", "forwarding"]),
				activatedAt: settings.activatedAt ?? now,
				validatedAt: now,
				updatedAt: now,
			})
			.where(eq(licenseSettings.id, LICENSE_SETTINGS_ID));
		settings.plan = "team";
		settings.state = "active";
		settings.seatLimit = null;
		settings.features = JSON.stringify(["branding", "accounts", "mailboxes", "forwarding"]);
	}

	return settings;
}

function toLicenseStatus(settings: typeof licenseSettings.$inferSelect): LicenseStatus {
	const active = settings.state === "active";
	const plan = active && (settings.plan === "pro" || settings.plan === "team") ? settings.plan : "team";
	return {
		plan,
		state: active ? settings.state : "active",
		features: parseFeatures(settings.features),
		seatLimit: null,
		instanceId: settings.instanceId,
		instanceUrl: settings.instanceUrl,
		active: true,
		activatedAt: settings.activatedAt ?? new Date(),
		validatedAt: settings.validatedAt ?? new Date(),
	};
}

export async function getLicenseStatus(env: CloudflareEnv): Promise<LicenseStatus> {
	return toLicenseStatus(await getOrCreateLicenseSettings(env));
}

export async function getLicenseEntitlements(_env: CloudflareEnv): Promise<LicenseEntitlements> {
	return {
		plan: "team",
		canCustomizeBranding: true,
		canManageAccounts: true,
		canShareMailboxes: true,
		accountSeatLimit: null,
		canForwardEmail: true,
	};
}

async function updateLicenseLocally(
	env: CloudflareEnv,
	action: PaymugLicenseAction,
	licenseKey: string,
	instanceUrl: string,
	requestedPlan?: Exclude<LicensePlan, "community">,
): Promise<LicenseStatus> {
	const settings = await getOrCreateLicenseSettings(env);
	const licenseKeyHash = licenseKey ? await hashLicenseKey(licenseKey) : null;
	const now = new Date();
	const db = getDb(env);

	if (action === "deactivate") {
		await db
			.update(licenseSettings)
			.set({
				licenseKeyHash: null,
				plan: "team",
				state: "active",
				features: JSON.stringify(["branding", "accounts", "mailboxes", "forwarding"]),
				seatLimit: null,
				validatedAt: now,
				updatedAt: now,
			})
			.where(eq(licenseSettings.id, LICENSE_SETTINGS_ID));
		return getLicenseStatus(env);
	}

	const plan = requestedPlan ?? (settings.plan === "pro" ? "pro" : "team");
	await db
		.update(licenseSettings)
		.set({
			licenseKeyHash: licenseKeyHash ?? settings.licenseKeyHash,
			instanceUrl: instanceUrl || settings.instanceUrl,
			plan,
			state: "active",
			features: JSON.stringify(["branding", "accounts", "mailboxes", "forwarding"]),
			seatLimit: null,
			activatedAt: settings.activatedAt ?? now,
			validatedAt: now,
			updatedAt: now,
		})
		.where(eq(licenseSettings.id, LICENSE_SETTINGS_ID));

	return getLicenseStatus(env);
}

export function activateLicense(
	env: CloudflareEnv,
	licenseKey: string,
	instanceUrl: string,
	plan: Exclude<LicensePlan, "community">,
) {
	return updateLicenseLocally(env, "activate", licenseKey, instanceUrl, plan);
}

export function validateLicense(env: CloudflareEnv, licenseKey: string, instanceUrl: string) {
	return updateLicenseLocally(env, "validate", licenseKey, instanceUrl);
}

export function deactivateLicense(env: CloudflareEnv) {
	return updateLicenseLocally(env, "deactivate", "", "");
}
