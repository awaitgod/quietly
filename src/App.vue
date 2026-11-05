<script setup lang="ts">
import EmojiText from './components/common/EmojiText.vue'

import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useAuthStore } from './stores/auth'
import { useChatStore } from './stores/chat'
import { useGroupsStore } from './stores/groups'
import { useContactsStore } from './stores/contacts'
import { useSettingsStore } from './stores/settings'
import { useAudioStore } from './stores/audio'
import { useEconomyStore } from './stores/economy'
import { usePresenceStore } from './stores/presence'

// Auth components
import BootLoader from './components/auth/BootLoader.vue'
import EmailScreen from './components/auth/EmailScreen.vue'
import OtpScreen from './components/auth/OtpScreen.vue'
import ProfileSetup from './components/auth/ProfileSetup.vue'
import PasswordLoginScreen from './components/auth/PasswordLoginScreen.vue'
import PasswordSetScreen from './components/auth/PasswordSetScreen.vue'
import ForgotPasswordScreen from './components/auth/ForgotPasswordScreen.vue'
import LegalModal from './components/auth/LegalModal.vue'

// Layout & Panes
import DesktopMenu from './components/layout/DesktopMenu.vue'
import MobileDock from './components/layout/MobileDock.vue'
import NowPlayingStrip from './components/layout/NowPlayingStrip.vue'
import ChatList from './components/chat/ChatList.vue'
import ChatView from './components/chat/ChatView.vue'
import SearchPane from './components/panes/SearchPane.vue'
import ContactsPane from './components/panes/ContactsPane.vue'
import UserProfilePane from './components/panes/UserProfilePane.vue'
import MyProfilePane from './components/panes/MyProfilePane.vue'
import EditProfilePane from './components/panes/EditProfilePane.vue'
import SettingsPane from './components/panes/SettingsPane.vue'

// Modals
import TopupModal from './components/modals/TopupModal.vue'
import PromoCodeModal from './components/modals/PromoCodeModal.vue'
import PhotoCropperModal from './components/modals/PhotoCropperModal.vue'
import GroupCreateModal from './components/modals/GroupCreateModal.vue'
import AudioPlayerModal from './components/modals/AudioPlayerModal.vue'
import TrackUploadModal from './components/modals/TrackUploadModal.vue'
import GiftsModal from './components/modals/GiftsModal.vue'
import AccountSwitcherModal from './components/modals/AccountSwitcherModal.vue'
import SolarIcon from './components/common/SolarIcon.vue'

const authStore = useAuthStore()
const chatStore = useChatStore()
const groupsStore = useGroupsStore()
const contactsStore = useContactsStore()
const settingsStore = useSettingsStore()
const audioStore = useAudioStore()
const economyStore = useEconomyStore()
const presenceStore = usePresenceStore()

const legalDocType = ref<'terms' | 'policy' | null>(null)
const cropperFile = ref<File | null>(null)
const profileSetupRef = ref<any>(null)
const isCreateGroupOpen = ref(false)
const isAccountSwitcherOpen = ref(false)
const giftRecipient = ref<{ id: string; name: string } | null>(null)
function openGiftCatalog(recipient?: { id: string; name: string }) {
  giftRecipient.value = recipient || (authStore.user?.id ? { id: authStore.user.id, name: authStore.profile?.name || 'Вы' } : null)
  economyStore.isGiftsCatalogOpen = true
}
const networkOnline = ref(typeof navigator === 'undefined' || navigator.onLine)
function updateNetworkStatus() {
  const wasOffline = !networkOnline.value
  networkOnline.value = navigator.onLine
  if (wasOffline && networkOnline.value && authStore.authScreen === 'logged_in') {
    void Promise.allSettled([chatStore.loadConversations(), groupsStore.loadUserGroups()])
  }
}
onMounted(() => { window.addEventListener('online', updateNetworkStatus); window.addEventListener('offline', updateNetworkStatus) })
onUnmounted(() => { window.removeEventListener('online', updateNetworkStatus); window.removeEventListener('offline', updateNetworkStatus) })

const isChatActive = computed(() => {
  return !!chatStore.activeChat || !!groupsStore.activeGroup
})

async function loadAppData() {
  await Promise.all([
    chatStore.loadConversations(),
    groupsStore.loadUserGroups(),
    contactsStore.loadContacts(),
    contactsStore.loadFrequentContacts(),
    audioStore.loadTracks(),
  ])
}

watch(
  () => [authStore.authScreen, authStore.user?.id] as const,
  ([screen, id]) => {
    if (screen === 'logged_in' && id) void presenceStore.start(id)
    else presenceStore.stop()
  },
  { immediate: true }
)
watch(() => authStore.profile?.online_visibility, () => { void presenceStore.updateOwnPresence() })
onUnmounted(() => { void presenceStore.writeLastSeen(); presenceStore.stop() })

watch(
  () => authStore.authScreen,
  async (newScreen) => {
    if (newScreen === 'logged_in') {
      await loadAppData()
    }
  }
)

onMounted(async () => {
  settingsStore.initTheme()
  await authStore.initAuth()
})

function onOpenLegal(doc: 'terms' | 'policy') {
  legalDocType.value = doc
}

function onOpenCropper(file: File) {
  cropperFile.value = file
}

function onCropped(blob: Blob) {
  profileSetupRef.value?.setCroppedAvatar(blob)
  cropperFile.value = null
}
</script>

<template>
  <div class="quietly-app">
    <!-- Boot Loader -->
    <BootLoader v-if="authStore.isLoading || authStore.authScreen === 'boot'" />

    <!-- Authentication Screens -->
    <template v-else-if="authStore.authScreen !== 'logged_in'">
      <EmailScreen
        v-if="authStore.authScreen === 'email'"
        @open-legal="onOpenLegal"
        @open-accounts="isAccountSwitcherOpen = true"
      />
      <OtpScreen v-else-if="authStore.authScreen === 'otp'" />
      <ProfileSetup
        v-else-if="authStore.authScreen === 'profile_setup'"
        ref="profileSetupRef"
        @open-cropper="onOpenCropper"
      />
      <PasswordLoginScreen v-else-if="authStore.authScreen === 'password_login'" />
      <PasswordSetScreen v-else-if="authStore.authScreen === 'password_set'" />
      <ForgotPasswordScreen v-else-if="authStore.authScreen === 'forgot'" />
    </template>

    <!-- Main Logged In Application Screen -->
    <div
      v-else
      id="loggedInScreen"
      class="active visible"
      :class="{ 'chat-open': isChatActive, 'has-player': audioStore.isNowPlayingStripVisible && audioStore.currentTrack }"
      :data-list-pane="settingsStore.currentPane"
    >
      <div v-if="!networkOnline" class="network-status" role="status" aria-live="polite"><SolarIcon name="home-wifi-outline" :size="16" /> Нет подключения к сети</div>
      <!-- Now Playing Strip (Sticky Top) -->
      <NowPlayingStrip />

      <!-- Desktop Hamburger Menu (fixed top-left on >= 1024px) -->
      <DesktopMenu @open-create-group="isCreateGroupOpen = true" @open-accounts="isAccountSwitcherOpen = true" />

      <!-- Left Column: Chats list (440px on Desktop) -->
      <aside class="chats-sidebar">
        <ChatList />
      </aside>

      <!-- Right Column: Active Pane / Chat View -->
      <main class="active-pane">
        <!-- DM or Group Chat View -->
        <ChatView v-if="isChatActive && settingsStore.currentPane === 'dm'" />

        <!-- Empty desktop state when no chat is open in DM pane (Screenshot 1) -->
        <div
          v-else-if="!isChatActive && settingsStore.currentPane === 'dm'"
          class="chat-empty-desktop"
        >
          <div class="empty-desktop-card">
            <div class="empty-icon-circle">
              <SolarIcon name="chat-round-dots-linear" :size="36" color="#52525e" />
            </div>
            <p class="empty-desc">Выберите чат слева, чтобы начать переписку</p>
          </div>
        </div>

        <!-- Search Pane -->
        <SearchPane v-else-if="settingsStore.currentPane === 'search'" />

        <!-- Contacts Pane -->
        <ContactsPane
          v-else-if="settingsStore.currentPane === 'contacts'"
          @open-create-group="isCreateGroupOpen = true"
        />

        <!-- Self Profile Pane -->
        <MyProfilePane
          v-else-if="settingsStore.currentPane === 'profile'"
          @open-topup="economyStore.isTopupOpen = true"
          @open-promo="economyStore.isPromoOpen = true"
          @open-accounts="isAccountSwitcherOpen = true"
          @edit-profile="settingsStore.setPane('edit-profile')"
        />

        <EditProfilePane v-else-if="settingsStore.currentPane === 'edit-profile'" @back="settingsStore.setPane('profile')" />

        <!-- Public User Profile Pane -->
        <UserProfilePane v-else-if="settingsStore.currentPane === 'user'" @send-gift="openGiftCatalog" />

        <!-- Settings Pane (Screenshot 3 & 5) -->
        <SettingsPane
          v-else-if="settingsStore.currentPane === 'settings'"
          @open-legal="onOpenLegal"
          @open-upload-track="audioStore.isUploadModalOpen = true"
          @open-gifts="openGiftCatalog()"
          @open-topup="economyStore.isTopupOpen = true"
        />
      </main>

      <!-- Mobile Bottom Navigation Dock -->
      <MobileDock />
    </div>

    <!-- Modals -->
    <AccountSwitcherModal v-if="isAccountSwitcherOpen" @close="isAccountSwitcherOpen = false" />
    <LegalModal :doc-type="legalDocType" @close="legalDocType = null" />
    <TopupModal v-if="economyStore.isTopupOpen" @close="economyStore.isTopupOpen = false" />
    <PromoCodeModal v-if="economyStore.isPromoOpen" @close="economyStore.isPromoOpen = false" />
    <GiftsModal
      v-if="economyStore.isGiftsCatalogOpen"
      :recipient-id="giftRecipient?.id"
      :recipient-name="giftRecipient?.name"
      @close="economyStore.isGiftsCatalogOpen = false"
    />
    <PhotoCropperModal
      v-if="cropperFile"
      :file="cropperFile"
      @cropped="onCropped"
      @close="cropperFile = null"
    />
    <GroupCreateModal v-if="isCreateGroupOpen" @close="isCreateGroupOpen = false" />
    <AudioPlayerModal />
    <TrackUploadModal v-if="audioStore.isUploadModalOpen" @close="audioStore.isUploadModalOpen = false" />

    <!-- Qcoin Toast Notification -->
    <div v-if="economyStore.coinToast.visible" class="gift-toast show">
      <span>Начислено +{{ economyStore.coinToast.amount }}</span>
      <span class="coin-ico"><EmojiText text="🪙" /></span>
    </div>
  </div>
</template>

<style scoped>
.network-status { position: fixed; z-index: 1000; top: var(--space-2); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); border-radius: 999px; background: var(--surface); color: var(--text); box-shadow: 0 6px 24px rgba(0,0,0,.22); font-size: var(--text-14); pointer-events: none; }
.quietly-app {
  width: 100vw;
  height: 100vh;
  display: flex;
  position: relative;
  overflow: hidden;
  background-color: var(--bg);
}

#loggedInScreen {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding-top: 0;
  box-sizing: border-box;
  transition: padding-top 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

#loggedInScreen.has-player { padding-top: 36px; box-sizing: border-box; }
.network-status { top: calc(var(--space-2) + var(--player-offset, 0px)); transition: top 260ms cubic-bezier(0.22, 1, 0.36, 1); }
@media (prefers-reduced-motion: reduce) { #loggedInScreen, .network-status { transition: none; } }
#loggedInScreen.has-player { --player-offset: 36px; }

.chats-sidebar {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.active-pane {
  display: none;
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

/* Mobile (< 768px): Chat open switches view */
@media (max-width: 767px) {
  #loggedInScreen.chat-open .chats-sidebar {
    display: none;
  }
  #loggedInScreen.chat-open .active-pane {
    display: flex;
  }
  #loggedInScreen:not(.chat-open) [data-list-pane]:not([data-list-pane="dm"]) .active-pane {
    display: flex;
  }
  #loggedInScreen:not(.chat-open) [data-list-pane="dm"] .active-pane {
    display: none;
  }
}

/* Desktop & Tablet (>= 768px): 2-Column Clean Layout */
@media (min-width: 768px) {
  #loggedInScreen {
    display: grid !important;
    grid-template-columns: 416px minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr) !important;
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    background-color: var(--bg);
  }

  .chats-sidebar {
    grid-column: 1;
    grid-row: 1;
    display: flex !important;
    width: 100%;
    height: 100%;
    overflow: hidden;
    padding: 0 !important;
    margin: 0 !important;
    border-right: none;
    background: var(--bg);
  }

  .active-pane {
    grid-column: 2;
    grid-row: 1;
    display: flex !important;
    width: 100%;
    height: 100%;
    overflow: hidden;
    padding: 0 !important;
    margin: 0 !important;
    background: var(--bg);
  }

  .chat-empty-desktop {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .empty-desktop-card {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .empty-icon-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background-color: var(--surface);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }

  .empty-desc {
    margin: 0;
    font-size: var(--text-14);
    color: var(--muted);
  }
}

.gift-toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%) translateY(30px);
  background-color: rgba(36, 36, 41, 0.95);
  backdrop-filter: blur(12px);
  padding: 12px 24px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-family: Unbounded, sans-serif;
  font-size: var(--text-14);
  font-weight: 700;
  opacity: 0;
  transition: transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28), opacity 0.25s ease;
  z-index: 9999;
}

.gift-toast.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

.coin-ico {
  font-size: var(--text-20);
}
</style>
