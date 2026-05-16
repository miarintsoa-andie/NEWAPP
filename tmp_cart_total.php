<?php
require 'config/config.inc.php';
$context = Context::getContext();
$context->currency = new Currency(1);
$context->language = new Language(1);
$context->country = new Country(1);
$context->shop = new Shop(1);
$context->cart = new Cart(78);
$context->customer = new Customer((int)$context->cart->id_customer);
$cart = $context->cart;
$types = [
  'ONLY_PRODUCTS' => Cart::ONLY_PRODUCTS,
  'ONLY_DISCOUNTS' => Cart::ONLY_DISCOUNTS,
  'BOTH_WITHOUT_SHIPPING' => Cart::BOTH_WITHOUT_SHIPPING,
  'BOTH' => Cart::BOTH,
  'ONLY_SHIPPING' => Cart::ONLY_SHIPPING,
  'ONLY_WRAPPING' => Cart::ONLY_WRAPPING,
];
foreach ($types as $label => $type) {
  $total = $cart->getOrderTotal(true, $type, null, (int)$cart->id_carrier, false, $context->customer->secure_key);
  echo $label . '=' . number_format((float)$total, 2, '.', '') . "\n";
}
