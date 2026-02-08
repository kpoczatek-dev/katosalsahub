<?php
header("Content-Type: application/json; charset=UTF-8");

// Sprawdź metodę żądania
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Metoda nie dozwolona."]);
    exit;
}

// Pobierz dane wejściowe (obsługa JSON)
$input = json_decode(file_get_contents("php://input"), true);

// Jeśli nie JSON, spróbuj klasycznego POST (dla pewności)
if (!$input) {
    $input = $_POST;
}

// ==========================================
// SPRAWDZENIE HONEYPOT (PLASTER MIODU)
// ==========================================
if (!empty($input['hp_chk'])) {
    // Jeśli pole 'hp_chk' jest wypełnione, to znaczy, że to bot.
    // Udajemy sukces, żeby bot nie próbował ponownie, ale nic nie wysyłamy.
    http_response_code(200);
    echo json_encode(["status" => "success", "message" => "Dziękujemy! Wiadomość została wysłana."]);
    exit;
}

// Pobierz i oczyść dane rzeczywiste
$name = isset($input['name']) ? trim($input['name']) : '';
$email = isset($input['email']) ? trim($input['email']) : '';
$message = isset($input['message']) ? trim($input['message']) : '';

// Walidacja - czy pola są wypełnione?
if (empty($name) || empty($email) || empty($message)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Wszystkie pola są wymagane."]);
    exit;
}

// Walidacja emaila
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Podano niepoprawny adres email."]);
    exit;
}

// Adres docelowy
$to = "poczatek.krzysztof@gmail.com";
$subject = "Nowa wiadomość z Kato Salsa Hub od: $name";

// Treść wiadomości
$email_content = "Imię i nazwisko: $name\n";
$email_content .= "Email: $email\n\n";
$email_content .= "Wiadomość:\n$message\n";

// ==========================================
// POPRAWIONE NAGŁÓWKI (Deliverability)
// ==========================================
// Ważne: 'From' powinno być domeną serwera, a nie mailem użytkownika.
// Ustawiamy Reply-To na email użytkownika.
$server_domain = $_SERVER['SERVER_NAME'];
$from_email = "noreply@" . $server_domain;

$headers = "From: Kato Salsa Hub <$from_email>\r\n";
$headers .= "Reply-To: $name <$email>\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "X-Mailer: PHP/" . phpversion();

// Wysłanie maila
$mailResult = mail($to, $subject, $email_content, $headers);

// Logowanie
$logEntry = date('Y-m-d H:i:s') . " - To: $to - Result: " . ($mailResult ? 'SUCCESS' : 'FAILURE') . "\n";
file_put_contents('../data/email_debug.txt', $logEntry, FILE_APPEND);

if ($mailResult) {
    http_response_code(200);
    echo json_encode(["status" => "success", "message" => "Dziękujemy! Wiadomość została wysłana."]);
} else {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Serwer odrzucił wysyłkę. Sprawdź plik email_debug.txt."]);
}
?>
