<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { splitEmoji } from '../../utils/emoji'
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'send'): void; (e: 'typing'): void }>()
const editor = ref<HTMLDivElement | null>(null)
let lastValue = '', composing = false, savedRange: Range | null = null
function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || ''
  if (node instanceof HTMLImageElement) return node.alt
  if (node instanceof HTMLBRElement) return '\n'
  let result = ''
  node.childNodes.forEach((child, i) => { if (i && child instanceof HTMLElement && /^(DIV|P)$/.test(child.tagName)) result += '\n'; result += textOf(child) })
  return result
}
function caretOffset(): number {
  const root = editor.value, selection = window.getSelection()
  if (!root || !selection?.rangeCount || !root.contains(selection.anchorNode)) return lastValue.length
  const range = selection.getRangeAt(0).cloneRange(); range.selectNodeContents(root); range.setEnd(selection.anchorNode!, selection.anchorOffset)
  return textOf(range.cloneContents()).length
}
function placeCaret(offset: number) {
  const root = editor.value; if (!root) return
  const selection = window.getSelection(), range = document.createRange(); let remaining = Math.max(0, offset), placed = false
  for (const child of Array.from(root.childNodes)) {
    const length = textOf(child).length
    if (remaining <= length) {
      if (child.nodeType === Node.TEXT_NODE) range.setStart(child, Math.min(remaining, child.textContent?.length || 0))
      else if (remaining === 0) range.setStartBefore(child)
      else range.setStartAfter(child)
      placed = true; break
    }
    remaining -= length
  }
  if (!placed) { range.selectNodeContents(root); range.collapse(false) }
  range.collapse(true); selection?.removeAllRanges(); selection?.addRange(range); savedRange = range.cloneRange()
}
function render(value: string, offset?: number) {
  const root = editor.value; if (!root) return
  const fragment = document.createDocumentFragment()
  for (const part of splitEmoji(value)) {
    if (part.url) { const img = document.createElement('img'); img.src = part.url; img.alt = part.text; img.className = 'editor-emoji'; img.draggable = false; img.contentEditable = 'false'; img.onerror = () => { img.replaceWith(document.createTextNode(part.text)) }; fragment.append(img) }
    else fragment.append(document.createTextNode(part.text))
  }
  root.replaceChildren(fragment); lastValue = value
  if (offset !== undefined) placeCaret(offset)
}
function sync() {
  const root = editor.value; if (!root) return
  if (root.childNodes.length === 1 && root.firstChild instanceof HTMLBRElement) root.replaceChildren()
  const value = textOf(root).replace(/\r\n/g, '\n'), offset = caretOffset()
  lastValue = value; emit('update:modelValue', value); emit('typing')
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let n: Node | null, hasNewEmoji = false
  while ((n = walker.nextNode())) { if (splitEmoji(n.textContent || '').some(p => p.url)) { hasNewEmoji = true; break } }
  if (hasNewEmoji) render(value, offset)
}
function rememberSelection() { const sel = window.getSelection(); if (editor.value && sel?.rangeCount && editor.value.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange() }
function insertText(value: string) {
  const root = editor.value; if (!root) return
  root.focus(); const sel = window.getSelection()
  if (savedRange && root.contains(savedRange.startContainer)) { sel?.removeAllRanges(); sel?.addRange(savedRange) }
  const range = sel?.rangeCount ? sel.getRangeAt(0) : document.createRange()
  if (!root.contains(range.startContainer)) { range.selectNodeContents(root); range.collapse(false) }
  range.deleteContents(); const node = document.createTextNode(value); range.insertNode(node); range.setStartAfter(node); range.collapse(true); sel?.removeAllRanges(); sel?.addRange(range); savedRange = range.cloneRange(); sync()
}
function keydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.isComposing && !composing) { e.preventDefault(); if (e.shiftKey) insertText('\n'); else emit('send') }
}
function paste(e: ClipboardEvent) { e.preventDefault(); insertText(e.clipboardData?.getData('text/plain') || '') }
function copySelection(e: ClipboardEvent, cut: boolean) {
  const root = editor.value, sel = window.getSelection()
  if (!root || !sel?.rangeCount || !root.contains(sel.anchorNode) || !root.contains(sel.focusNode) || sel.isCollapsed) return
  e.preventDefault()
  const range = sel.getRangeAt(0)
  e.clipboardData?.setData('text/plain', textOf(range.cloneContents()))
  if (cut) { range.deleteContents(); range.collapse(true); savedRange = range.cloneRange(); sync() }
}
function onInput() { if (!composing) sync() }
function compositionEnd() { composing = false; sync() }
watch(() => props.modelValue, value => { if (value !== lastValue) { render(value); if (!value && editor.value) editor.value.scrollTop = 0 } })
onMounted(() => render(props.modelValue))
defineExpose({ focus: () => editor.value?.focus(), getBoundingClientRect: () => editor.value?.getBoundingClientRect(), insertEmoji: (value: string) => { rememberSelection(); insertText(value); nextTick(() => editor.value?.focus()) } })
</script>
<template><div ref="editor" class="emoji-editor" contenteditable="true" role="textbox" aria-label="Текст сообщения" aria-multiline="true" data-placeholder="Сообщение..." spellcheck="true" @input="onInput" @keydown="keydown" @keyup="rememberSelection" @mouseup="rememberSelection" @blur="rememberSelection" @paste="paste" @copy="copySelection($event, false)" @cut="copySelection($event, true)" @compositionstart="composing = true" @compositionend="compositionEnd"></div></template>
<style scoped>
.emoji-editor { flex:1; min-width:0; min-height:24px; max-height:120px; overflow-y:auto; padding:0; outline:none; color:var(--text); font-family:inherit; font-size:var(--text-16); font-weight:400; line-height:24px; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word; user-select:text; -webkit-user-select:text; }
.emoji-editor:empty::before { content:attr(data-placeholder); color:#6b7280; pointer-events:none; }
.emoji-editor :deep(.editor-emoji) { display:inline-block; width:1em; height:1em; margin:0; padding:0; vertical-align:-.12em; object-fit:contain; }
</style>
