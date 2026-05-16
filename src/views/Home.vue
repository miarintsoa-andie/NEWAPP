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
    radial-gradient(circle at top left, rgba(34, 139, 230, 0.2), transparent 30%),
    radial-gradient(circle at bottom right, rgba(64, 192, 87, 0.14), transparent 28%),
    linear-gradient(135deg, #0f172a, #111827 55%, #0b1324);
}

.home-entry__panel {
  width: min(960px, 100%);
  padding: clamp(2rem, 5vw, 4rem);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 28px;
  background: rgba(15, 23, 42, 0.72);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(18px);
}

.home-entry__eyebrow {
  margin: 0 0 0.75rem;
  color: #7dd3fc;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.78rem;
  font-weight: 800;
}

.home-entry h1 {
  margin: 0;
  font-size: clamp(2.2rem, 4vw, 4.2rem);
  line-height: 1.05;
  color: #f8fafc;
}

.home-entry__lead {
  max-width: 60ch;
  margin: 1rem 0 0;
  color: rgba(226, 232, 240, 0.78);
  font-size: 1.05rem;
  line-height: 1.7;
}

.home-entry__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.entry-card {
  display: grid;
  gap: 0.6rem;
  padding: 1.5rem;
  border-radius: 20px;
  text-decoration: none;
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.entry-card:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
}

.entry-card--back {
  background: linear-gradient(180deg, rgba(34, 139, 230, 0.2), rgba(15, 23, 42, 0.96));
}

.entry-card--front {
  background: linear-gradient(180deg, rgba(64, 192, 87, 0.2), rgba(15, 23, 42, 0.96));
}

.entry-card__tag {
  color: #cbd5e1;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  font-weight: 800;
}

.entry-card strong {
  font-size: 1.4rem;
  color: #fff;
}

.entry-card span:last-child {
  color: rgba(226, 232, 240, 0.78);
  line-height: 1.6;
}

@media (max-width: 720px) {
  .home-entry__actions {
    grid-template-columns: 1fr;
  }
}
</style>
