/* Configuration de l'appli « La suite logique · CRM » (Firebase).
   Ces valeurs ne sont pas secrètes : la sécurité est assurée par les règles Firestore.
   Tant que apiKey est vide, l'appli tourne en MODE DÉMO :
   les données restent sur ce téléphone et rien n'est partagé. */
window.LSL_CONFIG = {
  apiKey: '',
  projectId: '',
  // Le compte administrateur (celui qui ajoute les membres). Même adresse que dans les règles Firestore.
  adminEmail: 'julien@lasuitelogique.fr'
};
