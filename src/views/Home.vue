<script setup>
</script>

<template>
  <section class="home-entry">
    <div class="home-entry__panel">
      <p class="home-entry__eyebrow">Bienvenue</p>
      <h1>Choisissez votre espace</h1>
      <p class="home-entry__lead">
        Accédez directement au back office pour gérer la plateforme ou ouvrez le front office pour consulter la boutique.
      </p>

      <div class="home-entry__actions">
        <router-link class="entry-card entry-card--back" :to="{ name: 'Login' }">
          <span class="entry-card__tag">Back office</span>
          <strong>Se connecter</strong>
          <span>Accéder au login puis au dashboard d’administration.</span>
        </router-link>

        <router-link class="entry-card entry-card--front" :to="{ name: 'FrontOfficeUserSelection' }">
          <span class="entry-card__tag">Front office</span>
          <strong>Page d'accueil du Front Office</strong>
          <span>Accéder à la boutique en tant qu'utilisateur.</span>
        </router-link>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-entry {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
  background:
    radial-gradient(circle at top left, rgba(31, 111, 235, 0.12), transparent 35%),
    radial-gradient(circle at bottom right, rgba(64, 192, 87, 0.1), transparent 30%),
    linear-gradient(135deg, #f0f7ff 0%, #ffffff 50%, #e6f0fa 100%);
}

.home-entry__panel {
  width: min(900px, 100%);
  padding: clamp(2.5rem, 6vw, 4.5rem);
  border: 1px solid rgba(31, 111, 235, 0.15);
  border-radius: 32px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 30px 70px rgba(31, 111, 235, 0.08);
  backdrop-filter: blur(20px);
}

.home-entry__eyebrow {
  margin: 0 0 0.75rem;
  color: #1f6feb;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 0.8rem;
  font-weight: 800;
}

.home-entry h1 {
  margin: 0;
  font-size: clamp(2rem, 3.5vw, 3.2rem);
  font-weight: 850;
  line-height: 1.1;
  color: #1e293b;
  letter-spacing: -0.03em;
}

.home-entry__lead {
  max-width: 60ch;
  margin: 1.2rem 0 0;
  color: #64748b;
  font-size: 1.05rem;
  line-height: 1.7;
}

.home-entry__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
  margin-top: 3rem;
}

.entry-card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 2rem;
  border-radius: 24px;
  text-decoration: none;
  color: inherit;
  border: 1px solid #e2e8f0;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  background: white;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -2px rgba(0, 0, 0, 0.02);
}

.entry-card:hover {
  transform: translateY(-5px);
}

.entry-card--back {
  background: linear-gradient(180deg, #ffffff, #f0f7ff);
}

.entry-card--back:hover {
  border-color: #1f6feb;
  box-shadow: 0 20px 35px rgba(31, 111, 235, 0.12);
}

.entry-card--front {
  background: linear-gradient(180deg, #ffffff, #f3faf5);
}

.entry-card--front:hover {
  border-color: #40c057;
  box-shadow: 0 20px 35px rgba(64, 192, 87, 0.1);
}

.entry-card__tag {
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 0.72rem;
  font-weight: 800;
}

.entry-card--back .entry-card__tag {
  color: #1f6feb;
}

.entry-card--front .entry-card__tag {
  color: #2b8a3e;
}

.entry-card strong {
  font-size: 1.35rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.entry-card span:last-child {
  color: #64748b;
  line-height: 1.6;
  font-size: 0.92rem;
}

@media (max-width: 720px) {
  .home-entry__actions {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
