#チェック対象csvファイルを引数で取得
Param($Arg1,$Arg2)
$csv1 = $Arg1
$csv2 = $Arg2

#main処理
if ((Test-Path -Path $csv1) -and (Test-Path -Path $csv2)) {
    $now_date = Get-Date -Format "yyyy/MM/dd"
    $csv1_date = (Get-ItemProperty $csv1).LastWriteTime.ToString("yyyy/MM/dd")
    $csv2_date = (Get-ItemProperty $csv2).LastWriteTime.ToString("yyyy/MM/dd")

    if (($now_date -eq $csv1_date) -and ($now_date -eq $csv2_date)) {
        return $true
    }
    else {
        return $false
    }
}
else {
    return $false
}
