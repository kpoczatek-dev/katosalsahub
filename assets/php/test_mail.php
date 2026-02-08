<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

$to = "poczatek.krzysztof@gmail.com";
$subject = "Test Mail PHP from Katosalsahub";
$message = "Jeśli to czytasz, funkcja mail() działa. \nData: " . date('Y-m-d H:i:s');
$headers = "From: no-reply@katosalsahub.pl\r\n";
$headers .= "Reply-To: no-reply@katosalsahub.pl\r\n";
$headers .= "X-Mailer: PHP/" . phpversion();

echo "<h1>Test wysyłania e-maila</h1>";
echo "<p>Próba wysłania do: <strong>$to</strong></p>";

if(mail($to, $subject, $message, $headers)) {
    echo "<h2 style='color:green'>Funkcja mail() zwróciła TRUE.</h2>";
    echo "<p>E-mail został przyjęty do kolejki serwera. Sprawdź folder SPAM.</p>";
} else {
    echo "<h2 style='color:red'>Funkcja mail() zwróciła FALSE.</h2>";
    echo "<p>Błąd po stronie serwera/PHP. Skontaktuj się z hostingiem.</p>";
    echo "<p>Ostatni błąd: " . print_r(error_get_last(), true) . "</p>";
}
?>
