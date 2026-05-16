<?php
require 'config/config.inc.php';
$db = Db::getInstance();
$rows = $db->executeS('SELECT * FROM `'._DB_PREFIX_.'cart_product` WHERE id_cart=78');
foreach ($rows as $row) {
  echo json_encode($row, JSON_UNESCAPED_UNICODE)."\n";
}
