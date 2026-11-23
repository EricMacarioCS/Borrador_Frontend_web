<template>
  <span class="brand" aria-label="Cinépolis">
    <span class="mark" aria-hidden="true">c</span>
    <span class="word" aria-hidden="true">cinépolis</span>
  </span>
</template>

<style scoped>
.brand { display: inline-flex; align-items: center; gap: 10px; color: #fff; }
.mark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: var(--grad-action);
  color: var(--navy-900);
  font: 800 italic 26px/1 var(--font-title);
  box-shadow: 0 0 18px rgba(56, 189, 248, .45), inset 0 1px 0 rgba(255, 255, 255, .6);
}
.word { font: 800 24px var(--font-title); letter-spacing: -.04em; }
</style>
