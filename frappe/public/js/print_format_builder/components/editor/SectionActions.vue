<template>
	<button
		class="es-button"
		data-size="xs"
		data-variant="ghost"
		data-icon-button="true"
		:title="__('Copy section')"
		@click.stop="store.copy_section(section)"
		v-html="frappe.utils.icon('copy', size)"
	></button>
	<button
		class="es-button"
		data-size="xs"
		data-variant="ghost"
		data-icon-button="true"
		:title="__('Duplicate section')"
		@click.stop="store.duplicate_section(section)"
		v-html="frappe.utils.icon('copy-plus', size)"
	></button>
	<button
		class="es-button"
		data-size="xs"
		data-variant="ghost"
		data-icon-button="true"
		:title="__('Save as snippet')"
		@click.stop="$emit('snippet')"
		v-html="frappe.utils.icon('bookmark-plus', size)"
	></button>
	<button
		class="es-button"
		data-size="xs"
		data-variant="ghost"
		data-theme="red"
		data-icon-button="true"
		:title="__('Remove section')"
		@click.stop="$emit('remove')"
		v-html="frappe.utils.icon('x', size)"
	></button>
</template>

<script setup>
import { inject } from "vue";

defineProps({
	section: { type: Object, required: true },
	size: { type: String, default: "sm" },
});
defineEmits(["snippet", "remove"]);

const store = inject("$store");
</script>

<style scoped>
/* [data-variant="ghost"] matches button.css's own selector specificity, so it's
   included here to win deterministically rather than relying on stylesheet order. */
.es-button[data-variant="ghost"] {
	color: var(--text-muted);
}

.es-button[data-variant="ghost"]:hover {
	color: var(--text-color);
}

.es-button[data-variant="ghost"][data-theme="red"] {
	color: var(--ink-red-8);
}
</style>
