const accounts = new Map();
export function getAccount(accountId) {
    return accounts.get(accountId);
}
export function saveAccount(account) {
    accounts.set(account.accountId, account);
    return account;
}
export function listAccounts() {
    return Array.from(accounts.values());
}
