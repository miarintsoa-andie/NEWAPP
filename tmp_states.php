<?php
require 'config/config.inc.php';
$db = Db::getInstance();
$rows = $db->executeS('SELECT os.id_order_state, osl.name, os.logable FROM `'._DB_PREFIX_.'order_state` os LEFT JOIN `'._DB_PREFIX_.'order_state_lang` osl ON osl.id_order_state=os.id_order_state AND osl.id_lang=1 ORDER BY os.id_order_state');
foreach($rows as $r) echo json_encode($r, JSON_UNESCAPED_UNICODE)."\n";
