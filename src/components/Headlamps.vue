<template>
  <!-- A1 headlamps, in the l6 master frame (4685x1707) so they ride that
       layer's box, parallax, and responsive scale. Geometry is the approved
       prototype scaled by 2.075, which is l6 master px per viewBox px at a
       1440x820 window (the A1 clip). The leader sits on the crest; the other
       three step down the right slope, each about 5 viewBox px into the rock. -->
<svg class="headlamps" viewBox="0 0 4685 1707" preserveAspectRatio="none" aria-hidden="true">
<defs>
<mask id="hl-midridge" maskUnits="userSpaceOnUse" x="0" y="0" width="4685" height="1707">
  <image href="/media/layers/l6-2400.webp" x="0" y="0" width="4685" height="1707" preserveAspectRatio="none" filter="url(#hl-alpha)"/>
</mask>
<filter id="hl-alpha" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/>
</filter>
<radialGradient id="hl-core"><stop offset="0" stop-color="#fffaf0"/><stop offset=".35" stop-color="#ffe3b0"/><stop offset="1" stop-color="#ffb020" stop-opacity="0"/></radialGradient>
<radialGradient id="hl-halo"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".6"/><stop offset=".5" stop-color="#ffc060" stop-opacity=".15"/><stop offset="1" stop-color="#ffb020" stop-opacity="0"/></radialGradient>
<radialGradient id="hl-patch"><stop offset="0" stop-color="#ffcf8a" stop-opacity=".42"/><stop offset=".35" stop-color="#ffb84a" stop-opacity=".12"/><stop offset=".7" stop-color="#ffb020" stop-opacity="0"/></radialGradient>
<radialGradient id="hl-warm"><stop offset="0" stop-color="#ff9a2a" stop-opacity=".95"/><stop offset=".35" stop-color="#ff8a1a" stop-opacity=".3"/><stop offset=".7" stop-color="#ff8000" stop-opacity="0"/></radialGradient>
<radialGradient id="hl-revealgrad"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".9"/><stop offset=".35" stop-color="#ffb860" stop-opacity=".5"/><stop offset=".7" stop-color="#ffaa40" stop-opacity=".12"/><stop offset="1" stop-color="#ff9a2a" stop-opacity="0"/></radialGradient>
<filter id="hl-rockfill" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .33 .33 .33 0 0"/>
  <feComponentTransfer><feFuncA type="table" tableValues="0 0 0 0 0 0 .3 1 1 1"/></feComponentTransfer>
  <feGaussianBlur stdDeviation="1.25"/>
</filter>
<filter id="hl-rockedge" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .33 .33 .33 0 0" result="lum"/>
  <feComponentTransfer in="lum" result="solid"><feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 1 1 1"/></feComponentTransfer>
  <feMorphology in="solid" operator="dilate" radius="3.32" result="fat"/>
  <feComposite in="fat" in2="solid" operator="out" result="edge"/>
  <feGaussianBlur in="edge" stdDeviation="1.87"/>
</filter>
<filter id="hl-rockfillj" x="-5%" y="-10%" width="110%" height="120%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.05301 0.02410" numOctaves="2" seed="7" result="n0"/>
  <feComponentTransfer in="n0" result="n"><feFuncR type="discrete" tableValues="0 .3 .55 .8 1"/><feFuncG type="discrete" tableValues="0 .35 .6 1"/></feComponentTransfer>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="12.45" xChannelSelector="R" yChannelSelector="G"/>
  <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .33 .33 .33 0 0"/>
  <feComponentTransfer><feFuncA type="table" tableValues="0 0 0 0 0 0 .3 1 1 1"/></feComponentTransfer>
  <feGaussianBlur stdDeviation="0.83"/>
</filter>
<filter id="hl-rockedgej" x="-5%" y="-10%" width="110%" height="120%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.05301 0.02410" numOctaves="2" seed="7" result="n0"/>
  <feComponentTransfer in="n0" result="n"><feFuncR type="discrete" tableValues="0 .3 .55 .8 1"/><feFuncG type="discrete" tableValues="0 .35 .6 1"/></feComponentTransfer>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="12.45" xChannelSelector="R" yChannelSelector="G"/>
  <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .33 .33 .33 0 0" result="lum"/>
  <feComponentTransfer in="lum" result="solid"><feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 1 1 1"/></feComponentTransfer>
  <feMorphology in="solid" operator="dilate" radius="3.74" result="fat"/>
  <feComposite in="fat" in2="solid" operator="out" result="edge"/>
  <feGaussianBlur in="edge" stdDeviation="1.35"/>
</filter>
<linearGradient id="hl-fv0" gradientUnits="userSpaceOnUse" x1="0" y1="105.88" x2="0" y2="298.86"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><linearGradient id="hl-fh0" gradientUnits="userSpaceOnUse" x1="1543.47" y1="0" x2="2763.57" y2="0"><stop offset="0" stop-color="#000"/><stop offset=".2" stop-color="#fff"/><stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><mask id="hl-fhm0" maskUnits="userSpaceOnUse" x="0" y="0" width="4685" height="1707"><rect x="1543.47" y="105.88" width="1220.1" height="192.98" fill="url(#hl-fh0)"/></mask><mask id="hl-fade0" maskUnits="userSpaceOnUse" x="0" y="0" width="4685" height="1707"><rect x="1543.47" y="105.88" width="1220.1" height="192.98" fill="url(#hl-fv0)" mask="url(#hl-fhm0)"/></mask><linearGradient id="hl-fv1" gradientUnits="userSpaceOnUse" x1="0" y1="163.98" x2="0" y2="332.06"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><linearGradient id="hl-fh1" gradientUnits="userSpaceOnUse" x1="1937.72" y1="0" x2="2975.22" y2="0"><stop offset="0" stop-color="#000"/><stop offset=".2" stop-color="#fff"/><stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><mask id="hl-fhm1" maskUnits="userSpaceOnUse" x="0" y="0" width="4685" height="1707"><rect x="1937.72" y="163.98" width="1037.5" height="168.08" fill="url(#hl-fh1)"/></mask><mask id="hl-fade1" maskUnits="userSpaceOnUse" x="0" y="0" width="4685" height="1707"><rect x="1937.72" y="163.98" width="1037.5" height="168.08" fill="url(#hl-fv1)" mask="url(#hl-fhm1)"/></mask><linearGradient id="hl-fv2" gradientUnits="userSpaceOnUse" x1="0" y1="230.38" x2="0" y2="383.93"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><linearGradient id="hl-fh2" gradientUnits="userSpaceOnUse" x1="1709.47" y1="0" x2="2869.4" y2="0"><stop offset="0" stop-color="#000"/><stop offset=".2" stop-color="#fff"/><stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><mask id="hl-fhm2" maskUnits="userSpaceOnUse" x="0" y="0" width="4685" height="1707"><rect x="1709.47" y="230.38" width="1159.93" height="153.55" fill="url(#hl-fh2)"/></mask><mask id="hl-fade2" maskUnits="userSpaceOnUse" x="0" y="0" width="4685" height="1707"><rect x="1709.47" y="230.38" width="1159.93" height="153.55" fill="url(#hl-fv2)" mask="url(#hl-fhm2)"/></mask>
<linearGradient id="hl-tfe" gradientUnits="userSpaceOnUse" x1="2238.6" y1="89.28" x2="2398.38" y2="180.58"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#e0e0e0"/><stop offset="1" stop-color="#1a1a1a"/></linearGradient>
<linearGradient id="hl-tff" gradientUnits="userSpaceOnUse" x1="2238.6" y1="89.28" x2="2398.38" y2="180.58"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#d0d0d0"/><stop offset="1" stop-color="#555"/></linearGradient>
<mask id="hl-topfadeedge" maskUnits="userSpaceOnUse" x="0" y="0" width="4685" height="1707"><rect width="4685" height="1707" fill="url(#hl-tfe)"/></mask>
<mask id="hl-topfadefill" maskUnits="userSpaceOnUse" x="0" y="0" width="4685" height="1707"><rect width="4685" height="1707" fill="url(#hl-tff)"/></mask>
<mask id="hl-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="4685" height="1707"><g opacity="1.0" mask="url(#hl-fade0)"><g filter="url(#hl-rockfillj)" opacity=".6" mask="url(#hl-topfadefill)"><g transform="translate(4307.05 0) scale(-1 1)"><svg x="1543.47" y="105.88" width="1220.1" height="192.98" viewBox="0 130 1471 310" preserveAspectRatio="none" overflow="hidden"><image href="/media/layers/headlamp-ridge.png" x="0" y="0" width="1471" height="841" preserveAspectRatio="none"/></svg></g></g><g filter="url(#hl-rockedgej)" opacity=".95" mask="url(#hl-topfadeedge)"><g transform="translate(4307.05 0) scale(-1 1)"><svg x="1543.47" y="105.88" width="1220.1" height="192.98" viewBox="0 130 1471 310" preserveAspectRatio="none" overflow="hidden"><image href="/media/layers/headlamp-ridge.png" x="0" y="0" width="1471" height="841" preserveAspectRatio="none"/></svg></g></g></g><g opacity="0.8" mask="url(#hl-fade1)"><g filter="url(#hl-rockfill)" opacity=".6"><svg x="1937.72" y="163.98" width="1037.5" height="168.08" viewBox="0 130 1471 310" preserveAspectRatio="none" overflow="hidden"><image href="/media/layers/headlamp-ridge.png" x="0" y="0" width="1471" height="841" preserveAspectRatio="none"/></svg></g><g filter="url(#hl-rockedge)" opacity=".9"><svg x="1937.72" y="163.98" width="1037.5" height="168.08" viewBox="0 130 1471 310" preserveAspectRatio="none" overflow="hidden"><image href="/media/layers/headlamp-ridge.png" x="0" y="0" width="1471" height="841" preserveAspectRatio="none"/></svg></g></g><g opacity="0.65" mask="url(#hl-fade2)"><g filter="url(#hl-rockfill)" opacity=".6"><svg x="1709.47" y="230.38" width="1159.93" height="153.55" viewBox="0 130 1471 310" preserveAspectRatio="none" overflow="hidden"><image href="/media/layers/headlamp-ridge.png" x="0" y="0" width="1471" height="841" preserveAspectRatio="none"/></svg></g><g filter="url(#hl-rockedge)" opacity=".9"><svg x="1709.47" y="230.38" width="1159.93" height="153.55" viewBox="0 130 1471 310" preserveAspectRatio="none" overflow="hidden"><image href="/media/layers/headlamp-ridge.png" x="0" y="0" width="1471" height="841" preserveAspectRatio="none"/></svg></g></g></mask>
<linearGradient id="hl-cone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe2b0" stop-opacity="0.85"/><stop offset="0.18" stop-color="#ffe2b0" stop-opacity="0.42"/><stop offset="0.45" stop-color="#ffe2b0" stop-opacity="0.12"/><stop offset="0.7" stop-color="#ffe2b0" stop-opacity="0"/></linearGradient>
<linearGradient id="hl-warmcone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffa63a" stop-opacity="0.89"/><stop offset="0.18" stop-color="#ffa63a" stop-opacity="0.44"/><stop offset="0.45" stop-color="#ffa63a" stop-opacity="0.13"/><stop offset="0.7" stop-color="#ffa63a" stop-opacity="0.00"/></linearGradient>
<filter id="hl-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10.38"/></filter>
<filter id="hl-blur" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="6.23"/></filter>
</defs>
<g class="warmth" mask="url(#hl-midridge)" opacity=".55"><g class="hiker hiker-0" transform="translate(2388 188.88)"><g class="beam look" style="--a0:-152deg;animation-duration:8s;animation-delay:-1.5s"><ellipse cx="114.13" cy="0" rx="62.25" ry="35.28" fill="url(#hl-warm)" filter="url(#hl-soft)"/></g></g><g class="hiker hiker-1" transform="translate(2421.2 224.59)"><g class="beam wig" style="--a0:-158deg;animation-duration:7.8s;animation-delay:-3.4s"><ellipse cx="114.13" cy="0" rx="62.25" ry="35.28" fill="url(#hl-warm)" filter="url(#hl-soft)"/></g></g><g class="hiker hiker-2" transform="translate(2456.47 269.21)"><g class="beam wig" style="--a0:-148deg;animation-duration:5.9s;animation-delay:-2.2s"><ellipse cx="114.13" cy="0" rx="62.25" ry="35.28" fill="url(#hl-warm)" filter="url(#hl-soft)"/></g></g><g class="hiker hiker-3" transform="translate(2487.6 295.99)"><g class="beam wig" style="--a0:-155deg;animation-duration:7.1s;animation-delay:-5s"><ellipse cx="114.13" cy="0" rx="62.25" ry="35.28" fill="url(#hl-warm)" filter="url(#hl-soft)"/></g></g><g class="hiker hiker-0" transform="translate(2388 188.88)"><g class="beam look" style="--a0:-152deg;animation-duration:8s;animation-delay:-1.5s"><path d="M0,-3.11 L207.5,-62.25 Q224.1,0 207.5,62.25 L0,3.11 Z" fill="url(#hl-warmcone)" filter="url(#hl-blur)"/></g></g><g class="hiker hiker-1" transform="translate(2421.2 224.59)"><g class="beam wig" style="--a0:-158deg;animation-duration:7.8s;animation-delay:-3.4s"><path d="M0,-3.11 L207.5,-62.25 Q224.1,0 207.5,62.25 L0,3.11 Z" fill="url(#hl-warmcone)" filter="url(#hl-blur)"/></g></g><g class="hiker hiker-2" transform="translate(2456.47 269.21)"><g class="beam wig" style="--a0:-148deg;animation-duration:5.9s;animation-delay:-2.2s"><path d="M0,-3.11 L207.5,-62.25 Q224.1,0 207.5,62.25 L0,3.11 Z" fill="url(#hl-warmcone)" filter="url(#hl-blur)"/></g></g><g class="hiker hiker-3" transform="translate(2487.6 295.99)"><g class="beam wig" style="--a0:-155deg;animation-duration:7.1s;animation-delay:-5s"><path d="M0,-3.11 L207.5,-62.25 Q224.1,0 207.5,62.25 L0,3.11 Z" fill="url(#hl-warmcone)" filter="url(#hl-blur)"/></g></g></g>
<g class="light" mask="url(#hl-midridge)"><g class="hiker hiker-0" transform="translate(2388 188.88)"><g class="beam look" style="--a0:-152deg;animation-duration:8s;animation-delay:-1.5s"><ellipse cx="114.13" cy="0" rx="62.25" ry="35.28" fill="url(#hl-patch)" filter="url(#hl-soft)"/></g></g><g class="hiker hiker-1" transform="translate(2421.2 224.59)"><g class="beam wig" style="--a0:-158deg;animation-duration:7.8s;animation-delay:-3.4s"><ellipse cx="114.13" cy="0" rx="62.25" ry="35.28" fill="url(#hl-patch)" filter="url(#hl-soft)"/></g></g><g class="hiker hiker-2" transform="translate(2456.47 269.21)"><g class="beam wig" style="--a0:-148deg;animation-duration:5.9s;animation-delay:-2.2s"><ellipse cx="114.13" cy="0" rx="62.25" ry="35.28" fill="url(#hl-patch)" filter="url(#hl-soft)"/></g></g><g class="hiker hiker-3" transform="translate(2487.6 295.99)"><g class="beam wig" style="--a0:-155deg;animation-duration:7.1s;animation-delay:-5s"><ellipse cx="114.13" cy="0" rx="62.25" ry="35.28" fill="url(#hl-patch)" filter="url(#hl-soft)"/></g></g></g>
<g class="light" opacity=".7" mask="url(#hl-midridge)"><g class="hiker hiker-0" transform="translate(2388 188.88)"><g class="beam look" style="--a0:-152deg;animation-duration:8s;animation-delay:-1.5s"><path d="M0,-3.11 L207.5,-62.25 Q224.1,0 207.5,62.25 L0,3.11 Z" fill="url(#hl-cone)" filter="url(#hl-blur)"/></g></g><g class="hiker hiker-1" transform="translate(2421.2 224.59)"><g class="beam wig" style="--a0:-158deg;animation-duration:7.8s;animation-delay:-3.4s"><path d="M0,-3.11 L207.5,-62.25 Q224.1,0 207.5,62.25 L0,3.11 Z" fill="url(#hl-cone)" filter="url(#hl-blur)"/></g></g><g class="hiker hiker-2" transform="translate(2456.47 269.21)"><g class="beam wig" style="--a0:-148deg;animation-duration:5.9s;animation-delay:-2.2s"><path d="M0,-3.11 L207.5,-62.25 Q224.1,0 207.5,62.25 L0,3.11 Z" fill="url(#hl-cone)" filter="url(#hl-blur)"/></g></g><g class="hiker hiker-3" transform="translate(2487.6 295.99)"><g class="beam wig" style="--a0:-155deg;animation-duration:7.1s;animation-delay:-5s"><path d="M0,-3.11 L207.5,-62.25 Q224.1,0 207.5,62.25 L0,3.11 Z" fill="url(#hl-cone)" filter="url(#hl-blur)"/></g></g></g>
<g class="light" mask="url(#hl-midridge)" opacity=".85"><g mask="url(#hl-reveal)"><g class="hiker hiker-0" transform="translate(2388 188.88)"><g class="beam look" style="--a0:-152deg;animation-duration:8s;animation-delay:-1.5s"><ellipse cx="103.75" cy="0" rx="128.65" ry="93.38" fill="url(#hl-revealgrad)"/></g></g><g class="hiker hiker-1" transform="translate(2421.2 224.59)"><g class="beam wig" style="--a0:-158deg;animation-duration:7.8s;animation-delay:-3.4s"><ellipse cx="103.75" cy="0" rx="128.65" ry="93.38" fill="url(#hl-revealgrad)"/></g></g><g class="hiker hiker-2" transform="translate(2456.47 269.21)"><g class="beam wig" style="--a0:-148deg;animation-duration:5.9s;animation-delay:-2.2s"><ellipse cx="103.75" cy="0" rx="128.65" ry="93.38" fill="url(#hl-revealgrad)"/></g></g><g class="hiker hiker-3" transform="translate(2487.6 295.99)"><g class="beam wig" style="--a0:-155deg;animation-duration:7.1s;animation-delay:-5s"><ellipse cx="103.75" cy="0" rx="128.65" ry="93.38" fill="url(#hl-revealgrad)"/></g></g></g></g>
<g class="light"><g class="hiker hiker-0" transform="translate(2388 188.88)"><circle r="22.83" fill="url(#hl-halo)" opacity="0.32"/><circle r="4.15" fill="url(#hl-core)"/><circle r="2.08" fill="#ffe8c2"/></g><g class="hiker hiker-1" transform="translate(2421.2 224.59)"><circle r="22.83" fill="url(#hl-halo)" opacity="0.32"/><circle r="4.15" fill="url(#hl-core)"/><circle r="2.08" fill="#ffe8c2"/></g><g class="hiker hiker-2" transform="translate(2456.47 269.21)"><circle r="22.83" fill="url(#hl-halo)" opacity="0.32"/><circle r="4.15" fill="url(#hl-core)"/><circle r="2.08" fill="#ffe8c2"/></g><g class="hiker hiker-3" transform="translate(2487.6 295.99)"><circle r="22.83" fill="url(#hl-halo)" opacity="0.32"/><circle r="4.15" fill="url(#hl-core)"/><circle r="2.08" fill="#ffe8c2"/></g></g>
</svg>

</template>

<style scoped>
.headlamps {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  overflow: hidden;
  pointer-events: none;
}

.light {
  mix-blend-mode: screen;
}

.warmth {
  mix-blend-mode: overlay;
}

/* Beam geometry points +X. Rotation is around the lamp. Rest aim is uphill (--a0). */
.beam {
  transform-origin: 0 0;
  transform: rotate(var(--a0));
}

.wig {
  animation: wig ease-in-out infinite;
}

@keyframes wig {
  0%,
  100% {
    transform: rotate(var(--a0));
  }
  22% {
    transform: rotate(calc(var(--a0) + 15deg));
  }
  48% {
    transform: rotate(calc(var(--a0) - 5.2deg));
  }
  70% {
    transform: rotate(calc(var(--a0) - 15deg));
  }
  86% {
    transform: rotate(calc(var(--a0) + 4.5deg));
  }
}

/* Look-back: uphill wiggle, then a 160deg counterclockwise turn to face
   back down the ridge, a short hold, and a turn back. Negative is CCW. */
.look {
  animation: look ease-in-out infinite;
}

@keyframes look {
  0%,
  100% {
    transform: rotate(var(--a0));
  }
  14% {
    transform: rotate(calc(var(--a0) + 15deg));
  }
  30% {
    transform: rotate(calc(var(--a0) - 15deg));
  }
  42% {
    transform: rotate(var(--a0));
  }
  56% {
    transform: rotate(calc(var(--a0) - 160deg));
  }
  64% {
    transform: rotate(calc(var(--a0) - 166deg));
  }
  72% {
    transform: rotate(calc(var(--a0) - 156deg));
  }
  86% {
    transform: rotate(calc(var(--a0) + 4deg));
  }
}

/* Narrow viewports crowd four halos on the crest. Keep the leader
   (hiker-0, the look-back) and the next companion (hiker-1). */
@media (max-width: 820px) {
  .hiker-2,
  .hiker-3 {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .beam {
    animation: none !important;
  }
}
</style>
