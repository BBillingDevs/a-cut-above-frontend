const KEY = "acutabove_wholesale_pin";

export function getWholesalePin(): string | null {
    return localStorage.getItem(KEY);
}

export function setWholesalePin(pin: string) {
    localStorage.setItem(KEY, pin);
}

export function clearWholesalePin() {
    localStorage.removeItem(KEY);
}

export function isWholesaleMode(): boolean {
    return !!getWholesalePin();
}
