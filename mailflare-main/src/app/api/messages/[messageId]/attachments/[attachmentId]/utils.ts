export function getAttachmentContentDisposition(filename: string, inline = false): string {
	const dispositionType = inline ? "inline" : "attachment";
	const cleanName = filename.replace(/[\r\n]/g, "").slice(0, 150) || "attachment";
	const asciiName = cleanName.replace(/[^\x20-\x7e]|["\\]/g, "_");
	const encodedName = encodeURIComponent(cleanName);
	return `${dispositionType}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}
