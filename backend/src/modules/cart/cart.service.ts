import type { Prisma } from '@prisma/client';
import { MAX_QUANTITY_PER_ITEM } from '../../config/pricing.js';
import { prisma } from '../../db/prisma.js';
import { AppError, Errors } from '../../shared/errors/AppError.js';
import { calculateOrderTotals } from '../../shared/money/pricing.js';
import { stockStatus } from '../catalog/catalog.service.js';

export type CartItemIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';

const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          brand: true,
          imageUrl: true,
          pricePaise: true,
          stockQuantity: true,
          isActive: true,
          category: { select: { isActive: true } },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

/**
 * Builds the cart response from current database prices and stock.
 * Totals are an estimate for display; checkout recalculates them inside its transaction.
 */
function toCartView(cart: CartWithItems | null) {
  const items = (cart?.items ?? []).map((item) => {
    const { product } = item;
    const available = product.isActive && product.category.isActive;
    let issue: CartItemIssue | null = null;
    if (!available) issue = 'UNAVAILABLE';
    else if (product.stockQuantity === 0) issue = 'OUT_OF_STOCK';
    else if (item.quantity > product.stockQuantity) issue = 'INSUFFICIENT_STOCK';

    return {
      id: item.id,
      quantity: item.quantity,
      lineTotalPaise: product.pricePaise * item.quantity,
      issue,
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        imageUrl: product.imageUrl,
        pricePaise: product.pricePaise,
        stockQuantity: product.stockQuantity,
        stockStatus: stockStatus(product.stockQuantity),
        isAvailable: available,
      },
    };
  });

  return {
    id: cart?.id ?? null,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    totals: calculateOrderTotals(
      items.map((item) => ({ unitPricePaise: item.product.pricePaise, quantity: item.quantity })),
    ),
    canCheckout: items.length > 0 && items.every((item) => item.issue === null),
  };
}

export type CartView = ReturnType<typeof toCartView>;

export async function getCart(userId: string): Promise<CartView> {
  const cart = await prisma.cart.findUnique({ where: { userId }, include: cartInclude });
  return toCartView(cart);
}

/** Early stock check for feedback. Checkout performs the authoritative check under row locks. */
function assertQuantityAvailable(
  product: { id: string; stockQuantity: number },
  requested: number,
  inCart: number,
) {
  if (requested > MAX_QUANTITY_PER_ITEM) {
    throw Errors.unprocessable(
      'QUANTITY_LIMIT',
      `You can add at most ${MAX_QUANTITY_PER_ITEM} of one product.`,
      { max: MAX_QUANTITY_PER_ITEM, inCart },
    );
  }
  if (requested > product.stockQuantity) {
    throw Errors.conflict('INSUFFICIENT_STOCK', 'The requested quantity is not available.', {
      productId: product.id,
      available: product.stockQuantity,
      requested,
      inCart,
    });
  }
}

async function findPurchasableProduct(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, stockQuantity: true, isActive: true, category: { select: { isActive: true } } },
  });
  if (!product) throw Errors.notFound('Product');
  if (!product.isActive || !product.category.isActive) {
    throw Errors.unprocessable('PRODUCT_UNAVAILABLE', 'This product is no longer available.');
  }
  return product;
}

/** Adds to the existing line if the product is already in the cart. */
export async function addItem(userId: string, productId: string, quantity: number): Promise<CartView> {
  const product = await findPurchasableProduct(productId);

  const cart = await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });
  const inCart = existing?.quantity ?? 0;

  assertQuantityAvailable(product, inCart + quantity, inCart);

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    create: { cartId: cart.id, productId, quantity },
    update: { quantity: inCart + quantity },
  });

  return getCart(userId);
}

const notInYourCart = () => new AppError(404, 'CART_ITEM_NOT_FOUND', 'Cart item not found.');

/** Ownership: the item must belong to the caller's cart, otherwise 404. */
export async function updateItem(userId: string, itemId: string, quantity: number): Promise<CartView> {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId } } });
  if (!item) throw notInYourCart();

  const product = await findPurchasableProduct(item.productId);
  assertQuantityAvailable(product, quantity, item.quantity);

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  return getCart(userId);
}

export async function removeItem(userId: string, itemId: string): Promise<CartView> {
  const { count } = await prisma.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
  if (count === 0) throw notInYourCart();
  return getCart(userId);
}

export async function clearCart(userId: string): Promise<CartView> {
  await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
  return getCart(userId);
}
