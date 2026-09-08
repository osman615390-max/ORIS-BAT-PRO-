# ORIS BAT PRO — V6.3 VERIFIED 360

Cette version corrige le Studio 360° en profondeur.

## Correction principale
Le Studio 360° ne dépend plus de Three.js, jsDelivr, d’un import map ou d’un CDN.
Le moteur 3D est désormais **100 % local et autonome**, écrit directement en WebGL 1 compatible Safari/iPhone et navigateurs modernes.

Cela supprime les principales causes de panne observées :
- chargement CDN bloqué ou lent ;
- import ES module / importmap non résolu ;
- exigence WebGL 2 inutile ;
- modules Three.js trop lourds sur mobile ;
- cache d’une ancienne version du viewer.

## Fonctions 360° conservées
- rotation 360° au doigt ou à la souris ;
- pinch / molette pour zoomer ;
- vues Global / Terrassement / Maçonnerie / Façade / Accès / Machine / Camion ;
- étapes Terrain brut / Travaux / Projet fini ;
- choix de finition façade ;
- choix du sol de cour ;
- réglage de l’heure / lumière ;
- visite cinéma ;
- hotspots 3D ;
- plein écran ;
- capture sur navigateur compatible ;
- fallback photo si WebGL est réellement indisponible.

## Déploiement
Remplacer **tous les fichiers** de la version précédente par ceux de ce dossier afin d’éviter qu’un ancien service worker ou un ancien viewer reste en cache.

GitHub Pages : tous les fichiers restent à la racine du dépôt.

## Transparence
La scène 3D et les images sont des visualisations conceptuelles, pas des photos ou plans d’exécution de chantiers réels.


## Correctifs V6.3
- Moteur 360 local WebGL sans CDN / Three.js.
- Initialisation 3D immédiate et déterministe (suppression de la course IntersectionObserver).
- Gestes tactiles iPhone renforcés : rotation, pincement/zoom, capture de pointeur sécurisée.
- Triple tentative de contexte WebGL avec profil de compatibilité Safari.
- ResizeObserver avec secours window.resize.
- Ancien watchdog V6.1 supprimé pour éviter les bascules photo concurrentes.
- Cache service worker V6.3 renouvelé et network-first.
- Tests navigateur desktop/mobile et audit multi-pages avant livraison.
