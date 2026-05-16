<?php
require 'config/config.inc.php';
$db = Db::getInstance();
$key = '3IGD3M1YJE8JB73DPLVXU3XLK79N8V46';
$account = $db->getRow("SELECT * FROM `"._DB_PREFIX_."webservice_account` WHERE `key`='".pSQL($key)."'");
var_export($account);
echo "\n--- permissions ---\n";
if ($account) {
  $perms = $db->executeS('SELECT * FROM `'._DB_PREFIX_.'webservice_permission` WHERE id_webservice_account='.(int)$account['id_webservice_account'].' ORDER BY resource');
  foreach ($perms as $p) {
    echo json_encode($p, JSON_UNESCAPED_UNICODE)."\n";
  }
}
