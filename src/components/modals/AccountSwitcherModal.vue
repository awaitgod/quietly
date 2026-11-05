<script setup lang="ts">
import { computed, ref } from 'vue'
import { activeAccountSlot, newAccountSlot, savedAccounts, selectAccountSlot } from '../../services/accountStorage'
import SolarIcon from '../common/SolarIcon.vue'

const emit = defineEmits<{ (event: 'close'): void }>()
const accounts = ref(savedAccounts())
const active = activeAccountSlot()
const switching = ref(false)
const selectedName = ref('')
const hasAccounts = computed(() => accounts.value.length > 0)

function switchTo(slot: string, name: string) {
  if (switching.value) return
  if (slot === active && hasAccounts.value) { emit('close'); return }
  switching.value = true
  selectedName.value = name
  selectAccountSlot(slot)
  window.setTimeout(() => window.location.reload(), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300)
}
function addAccount() { switchTo(newAccountSlot(), 'Добавляем аккаунт') }
</script>

<template>
  <div class="account-overlay" @click.self="!switching && emit('close')">
    <section class="account-card" role="dialog" aria-modal="true" aria-labelledby="accounts-title">
      <header class="account-head">
        <div><h2 id="accounts-title">Аккаунты</h2><p>Все ваши профили в одном месте</p></div>
        <button class="account-close" type="button" aria-label="Закрыть" :disabled="switching" @click="emit('close')"><SolarIcon name="close-circle-linear" :size="24" /></button>
      </header>
      <div class="account-list">
        <button v-for="account in accounts" :key="account.slot" class="account-row" type="button" :disabled="switching" @click="switchTo(account.slot, account.name)">
          <span class="account-avatar"><img v-if="account.avatarUrl" :src="account.avatarUrl" alt="" /><span v-else>{{ account.name.charAt(0).toUpperCase() }}</span></span>
          <span class="account-info"><strong>{{ account.name }}</strong><small>{{ account.username ? '@' + account.username : account.email }}</small></span>
          <span v-if="account.slot === active" class="account-current">Вы здесь</span>
          <SolarIcon v-else name="alt-arrow-right-linear" :size="20" class="account-arrow" />
        </button>
        <button class="account-add" type="button" :disabled="switching" @click="addAccount"><span class="account-add-icon"><SolarIcon name="add-circle-linear" :size="24" /></span><span>Добавить аккаунт</span></button>
      </div>
      <Transition name="switch-fade"><div v-if="switching" class="account-switching" role="status"><span class="switch-mark"><img src="/quietly-icon.png" alt="" /></span><strong>{{ selectedName }}</strong><small>Переключаем аккаунт…</small></div></Transition>
    </section>
  </div>
</template>

<style scoped>
.account-overlay { position: fixed; inset: 0; z-index: 12000; display: grid; place-items: center; padding: 20px; background: rgba(0,0,0,.6); backdrop-filter: blur(8px); animation: overlay-in .2s ease both; }
.account-card { position: relative; width: min(100%, 400px); max-height: min(80vh, 620px); overflow: hidden; border-radius: 28px; padding: 24px; background: var(--surface); color: var(--text); box-shadow: 0 24px 70px rgba(0,0,0,.35); animation: card-in .3s cubic-bezier(.22,1,.36,1) both; }
.account-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:20px; }
.account-head h2 { margin: 0; font: 700 var(--text-20) Unbounded, sans-serif; }
.account-head p { margin: 8px 0 0; color: var(--muted); font-size: var(--text-14); }
.account-close { border:0; padding:4px; background:transparent; color:var(--muted); cursor:pointer; }
.account-list { display:flex; flex-direction:column; gap:8px; overflow-y:auto; max-height: min(55vh, 440px); }
.account-row, .account-add { width:100%; border:0; display:flex; align-items:center; gap:12px; text-align:left; border-radius:18px; padding:12px; background:var(--bg); color:var(--text); font:inherit; cursor:pointer; transition:background-color .2s, transform .2s; }
.account-row:hover, .account-add:hover { background: #303038; }
:global(html[data-theme="light"]) .account-row:hover, :global(html[data-theme="light"]) .account-add:hover { background: #e1e3eb; }
.account-row:active, .account-add:active { transform:scale(.98); }
.account-avatar, .account-add-icon { flex:none; width:48px; height:48px; border-radius:50%; overflow:hidden; display:grid; place-items:center; background:#6070df; color:white; font-weight:700; font-size:18px; }
.account-avatar img { width:100%; height:100%; object-fit:cover; }
.account-add-icon { background:var(--surface); color:var(--text); }
.account-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
.account-info strong, .account-info small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.account-info small { color:var(--muted); }
.account-current { color:#719dff; font-size:12px; white-space:nowrap; }
.account-arrow { color:var(--muted); flex:none; }
.account-add { font-weight:600; }
.account-switching { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; background:var(--surface); text-align:center; }
.account-switching small { color:var(--muted); }
.switch-mark { display:grid; place-items:center; width:72px; height:72px; border-radius:24px; background:var(--bg); animation:mark-in .3s ease both; }
.switch-mark img { width:48px; height:48px; object-fit:contain; }
.switch-fade-enter-active { transition:opacity .25s ease; }.switch-fade-enter-from { opacity:0; }
@keyframes overlay-in { from { opacity:0 } to { opacity:1 } }
@keyframes card-in { from { opacity:0; transform:translateY(12px) scale(.97) } to { opacity:1; transform:none } }
@keyframes mark-in { from { transform:scale(.85); opacity:0 } to { transform:scale(1); opacity:1 } }
@media (prefers-reduced-motion: reduce) { .account-overlay, .account-card, .switch-mark { animation:none; } .account-row, .account-add, .switch-fade-enter-active { transition:none; } }
</style>
