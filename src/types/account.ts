export type CheckoutUser = {
	id: string
	email: string
	name?: string
}

export type Account = {
	accountId: string
	email: string
	name?: string
	createdAt: string
	updatedAt: string
}

export type BuyerSnapshot = {
	accountId: string
	email: string
	name?: string
}
