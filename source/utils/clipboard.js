export function copySelectionToClipboard(renderer, selection) {
	if (!selection || selection.isDragging) return false;

	const text = selection.getSelectedText();
	if (!text) return false;

	return renderer.copyToClipboardOSC52(text);
}
