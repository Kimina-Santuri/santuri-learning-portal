// Public connection settings only. Never put a secret/service-role key here.
// Shares the santuri-bookings Supabase project so each person keeps one Santuri account.
window.SANTURI_CONFIG = Object.freeze({
  supabaseUrl: "https://gudbkpwxszdtirewawep.supabase.co",
  supabasePublishableKey: "sb_publishable_dWNhwRs1aG85mkm6CUK2QQ_I66lX3Rx",
  accountsEnabled: true,
  supportEmail: "admissions@santuri.org"
});
