<script setup lang="ts">
import SolarIcon from '../common/SolarIcon.vue'

defineProps<{
  docType: 'terms' | 'policy' | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <div v-if="docType" class="app-overlay center show" @click.self="emit('close')">
    <div class="legal-card">
      <div class="legal-head">
        <h2>
          {{ docType === 'terms' ? 'Пользовательское соглашение' : 'Политика конфиденциальности' }}
        </h2>
        <button type="button" class="close-btn" @click="emit('close')">
          <SolarIcon name="close-circle-linear" :size="24" />
        </button>
      </div>

      <div class="legal-body">
        <div v-if="docType === 'terms'">
          <h3>1. Общие положения</h3>
          <p>
            Настоящее Пользовательское соглашение регулирует условия использования мессенджера Quietly.
            Используя Quietly, вы соглашаетесь соблюдать правила и условия платформы.
          </p>
          <h3>2. Учётная запись и безопасность</h3>
          <p>
            Пользователь несёт ответственность за безопасность своих учётных данных.
            Запрещается передавать доступ третьим лицам или использовать платформу для распространения спама.
          </p>
          <h3>3. Qcoin и покупки</h3>
          <p>
            Qcoin является внутренней виртуальной единицей платформы Quietly для покупки подарков и кастомизации.
            Приобретая Qcoin, пользователь соглашается с тарифами и условиями платёжных систем.
          </p>
        </div>

        <div v-else>
          <h3>1. Сбор и обработка информации</h3>
          <p>
            Quietly уважает вашу конфиденциальность. Мы собираем только те данные, которые необходимы
            для функционирования сервиса (email для авторизации, профильные данные, сообщения).
          </p>
          <h3>2. Защита данных</h3>
          <p>
            Все персональные данные и переписки передаются по защищённым протоколам (TLS) и шифруются
            в локальной базе данных на стороне нативного клиента.
          </p>
          <h3>3. Ваши права</h3>
          <p>
            Вы имеете право в любой момент запросить удаление своего аккаунта и всей связанной истории
            в настройках профиля.
          </p>
        </div>
      </div>

      <div class="legal-foot">
        <button type="button" class="btn-primary" @click="emit('close')">Закрыть</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.legal-card {
  width: 100%;
  max-width: 500px;
  max-height: 85vh;
  background-color: var(--surface);
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.legal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6) var(--space-4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.legal-head h2 {
  margin: 0;
  font-size: var(--text-20);
  font-family: Unbounded, sans-serif;
  font-weight: 700;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #fff;
}

.legal-body {
  padding: var(--space-5) var(--space-6);
  overflow-y: auto;
  font-size: var(--text-14);
  line-height: 1.6;
  color: #d4d4d8;
}

.legal-body h3 {
  font-size: var(--text-16);
  font-weight: 600;
  color: #fff;
  margin: var(--space-4) 0 var(--space-1-5);
}

.legal-body h3:first-child {
  margin-top: 0;
}

.legal-body p {
  margin: 0 0 var(--space-3);
}

.legal-foot {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  padding: var(--space-2-5) 26px;
  border-radius: 999px;
  border: none;
  background-color: #fff;
  color: #111;
  font-family: Unbounded, sans-serif;
  font-size: var(--text-14);
  font-weight: 600;
  cursor: pointer;
}
</style>
