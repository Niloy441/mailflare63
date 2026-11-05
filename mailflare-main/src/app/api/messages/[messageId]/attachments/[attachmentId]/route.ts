import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { getAttachmentForUser } from "@/lib/email/attachments";
import { getAttachmentContentDisposition } from "./utils";
import type { MessageAttachmentRouteParams } from "./types";

export async function GET(request: Request, { params }: MessageAttachmentRouteParams) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return new Response("Unauthorized", { status: 401 });

	const { messageId, attachmentId } = await params;
	const attachment = await getAttachmentForUser(env, user, messageId, attachmentId);
	if (!attachment) return new Response("Attachment not found", { status: 404 });

	const object = await env.BUCKET.get(attachment.r2Key);
	if (!object) return new Response("File not found", { status: 404 });

	const url = new URL(request.url);
	const inline = url.searchParams.get("preview") === "1";

	const headers = new Headers();
	headers.set("Content-Type", attachment.contentType || "application/octet-stream");
	headers.set("Content-Length", String(attachment.size));
	headers.set("Content-Disposition", getAttachmentContentDisposition(attachment.filename, inline));
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Cache-Control", "private, no-store");
	return new Response(object.body, { headers });
}
