# Windows Power Shell で rakumoAPIを叩く
$rakumo = @{
    key = "";
    secret = "";
    domain = "a-rakumo.appspot.com";
}

function Get-RakumoDateHeader {
    param([System.DateTime] $Date=[DateTime]::Now)

    $ci = New-Object System.Globalization.CultureInfo("en-US")
    $utcTime = [TimeZoneInfo]::ConvertTimeToUtc($Date)
    $dateHeader = ($utcTime).ToString((New-Object system.globalization.datetimeformatinfo).RFC1123Pattern, $ci)
    return $dateHeader
}

# 署名の生成
function Get-Signature {
    param(
        [String] $Method,
        [String] $ContentType,
        [String] $DateHeader
    )
    $Method = $Method.ToUpper()
    $ContentType = $ContentType -replace ';.+' # ';' 以降を取り除く
    $message = $Method.ToUpper() + "`n" + $ContentType + "`n" + $DateHeader
    $hmacsha1 = New-Object System.Security.Cryptography.HMACSHA1
    $hmacsha1.key = [Text.Encoding]::ASCII.GetBytes($rakumo.secret)
    $signature = [Convert]::ToBase64String($hmacsha1.ComputeHash([Text.Encoding]::ASCII.GetBytes($message)))
    return $signature
}

function Get-RequestHeader {
    param(
        [String] $Method,
        [String] $ContentType
    )

   if ($Method.toUpper() -eq 'GET') { $ContentType = "" }
    $dateHeader = Get-RakumoDateHeader
    $signature = (Get-Signature -Method $Method -ContentType $ContentType -DateHeader $dateHeader)
    $authorization = "RWS " + $rakumo.key + ":" + $signature
    return @{
        "Content-type" = $contentType;
        "Date" = $dateHeader;
        "Authorization" = $authorization;
    }
}

function Call-RakumoAPI {
    param(
        [Uri] $Uri,
        [String] $Method,
        [String] $ContentType,
        [Object] $Body
    )
    #$proxyServer = ""
    $headers = Get-RequestHeader -Method $method -ContentType $contentType;
    if ([Bool]$Body -eq $False) {
        # Invoke-RestMethodではレスポンスに文字コードが付与されていないため、変更
        #$con = Invoke-WebRequest -Uri $Uri -Method $Method -Headers $headers -ContentType $ContentType -Proxy $proxyServer;
        $con = Invoke-WebRequest -Uri $Uri -Method $Method -Headers $headers -ContentType $ContentType;
        # レスポンスのコンテンツをUTF8化
        $res = [System.Text.Encoding]::Utf8.GetString($con.RawContentStream.GetBuffer());
        # コンテンツの後ろに空白が入るため削除
        $res = $res -replace "\u0000","";
        $res = $res.trim();

    } else {
        #$con = Invoke-WebRequest -Uri $Uri -Method $Method -Headers $headers -ContentType $ContentType -Body $Body -Proxy $proxyServer;
        $con = Invoke-WebRequest -Uri $Uri -Method $Method -Headers $headers -ContentType $ContentType -Body $Body;
        # レスポンスのコンテンツをUTF8化
        $res = [System.Text.Encoding]::Utf8.GetString($con.RawContentStream.GetBuffer());
        # コンテンツの後ろに空白が入るため削除
        $res = $res -replace "\u0000","";
        $res = $res.trim();
    }
    return $res;
}

# Contact: download csv
# 'Get-ContactProfile | Out-File "<FilePath>"' でダウンロード
function Get-ContactProfile {
    param(
        [String] $Target = "in",
        [String] $OutputPath = "export.csv"
    )
    $url = "https://" + $rakumo.domain + "/api/1/master/profiles" + "?target=" + $Target;
    $method = "GET";
    $contentType = "";
    $csv = Call-RakumoAPI -Uri $url -Method $method -ContentType $contentType;
    return $csv;
}