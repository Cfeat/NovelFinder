$ErrorActionPreference = 'Stop'
$novelOrigin = if ($env:NOVEL_TEST_ORIGIN) { $env:NOVEL_TEST_ORIGIN } else { 'http://127.0.0.1:8787' }
if (([uri]$novelOrigin).Host -notin @('localhost', '127.0.0.1')) { throw 'Only test the local database' }
$novelMarker = [guid]::NewGuid().ToString()
$novelUserA = "novel-test-a-$novelMarker"
$novelUserB = "novel-test-b-$novelMarker"
function Send-NovelRequest($Method, $Body, $User, $Path='/api/favorites', $ExtraHeaders=@{}) {
  $novelHeaders = @{}
  if ($User) { $novelHeaders['oai-authenticated-user-id'] = $User; $novelHeaders['oai-authenticated-user-email'] = 'test@sites.test' }
  foreach ($key in $ExtraHeaders.Keys) { $novelHeaders[$key] = $ExtraHeaders[$key] }
  $novelArgs = @{ Uri="$novelOrigin$Path"; Method=$Method; Headers=$novelHeaders; UseBasicParsing=$true; SkipHttpErrorCheck=$true }
  if ($null -ne $Body) { $novelArgs.ContentType='application/json'; $novelArgs.Body=($Body | ConvertTo-Json -Compress) }
  $novelResponse = Invoke-WebRequest @novelArgs
  return @{ Status=[int]$novelResponse.StatusCode; Data=($novelResponse.Content | ConvertFrom-Json) }
}
function Assert-Novel($Condition, $Message) { if (-not $Condition) { throw $Message } }
$novelAnon = Send-NovelRequest 'GET' $null $null
Assert-Novel ($novelAnon.Status -eq 200 -and -not $novelAnon.Data.signedIn) 'Anonymous read failed'
Assert-Novel ((Send-NovelRequest 'POST' @{id='mysteries'} $null).Status -eq 401) 'Anonymous write must be rejected'
try {
  $novelCatalog = Send-NovelRequest 'GET' $null $novelUserA '/api/catalog'
  Assert-Novel ($novelCatalog.Status -eq 200 -and $novelCatalog.Data.books.Count -gt 700 -and $novelCatalog.Data.coverage -eq 'partial') 'Unified catalog failed'
  Assert-Novel ((Send-NovelRequest 'POST' @{force=$false} $null '/api/catalog').Status -eq 401) 'Anonymous catalog sync allowed'
  Assert-Novel ((Send-NovelRequest 'POST' @{force=$false} $novelUserA '/api/catalog' @{Origin='https://other.invalid'}).Status -eq 403) 'Cross-origin sync allowed'
  Assert-Novel ((Send-NovelRequest 'GET' $null $null '/api/catalog/search?q=test').Status -eq 401) 'Anonymous public search allowed'
  $novelPlatformBook = $novelCatalog.Data.books | Where-Object platform -eq 'fanqie' | Select-Object -First 1
  $novelPlatformSave = Send-NovelRequest 'POST' @{id=$novelPlatformBook.id} $novelUserA
  Assert-Novel ($novelPlatformSave.Status -eq 201) 'Platform favorite save failed'
  $novelReloaded = (Send-NovelRequest 'GET' $null $novelUserA).Data.favorites[0]
  Assert-Novel ($novelReloaded.platform -eq 'fanqie' -and $novelReloaded.source -eq $novelPlatformBook.source -and $novelReloaded.providerId -eq $novelPlatformBook.providerId) 'Platform provenance lost after reload'
  Send-NovelRequest 'DELETE' $null $novelUserA ("/api/favorites?id=" + $novelPlatformBook.id) | Out-Null
  $novelAdded = Send-NovelRequest 'POST' @{id='mysteries'} $novelUserA
  Assert-Novel ($novelAdded.Status -eq 201) ('Save failed: ' + ($novelAdded.Data | ConvertTo-Json -Depth 6 -Compress))
  Assert-Novel ($novelAdded.Data.favorites[0].title -eq '诡秘之主') 'Wrong saved title'
  Assert-Novel ((Send-NovelRequest 'GET' $null $novelUserA).Data.favorites.Count -eq 1) 'Read after save failed'
  Assert-Novel ((Send-NovelRequest 'GET' $null $novelUserB).Data.favorites.Count -eq 0) 'User records leaked'
  Assert-Novel ((Send-NovelRequest 'POST' @{id='mysteries'} $novelUserA).Status -eq 409) 'Duplicate allowed'
  Assert-Novel ((Send-NovelRequest 'POST' @{title=' 《诡秘之主》 ';tags=@('情感')} $novelUserA).Status -eq 409) 'Normalized duplicate allowed'
  foreach ($novelInvalid in @(@{id='unknown'}, @{title=' ';tags=@('悬疑')}, @{title='测试';tags=@()}, @{title='测试';tags=@('不存在')}, @{title='测试';tags=@('悬疑');userId=$novelUserB})) {
    Assert-Novel ((Send-NovelRequest 'POST' $novelInvalid $novelUserA).Status -eq 400) 'Invalid input accepted'
  }
  Assert-Novel ((Send-NovelRequest 'POST' @{id='dawn'} $novelUserA '/api/favorites' @{Origin='https://other.invalid'}).Status -eq 403) 'Cross-origin write accepted'
  $novelCustom = Send-NovelRequest 'POST' @{title='书库外的测试作品';author='测试作者';tags=@('悬疑','推理','悬疑')} $novelUserA
  Assert-Novel ($novelCustom.Status -eq 201 -and $novelCustom.Data.favorites.Count -eq 2) 'Custom novel failed'
  $novelCustomBook = $novelCustom.Data.favorites | Where-Object title -eq '书库外的测试作品'
  Assert-Novel ($novelCustomBook.tags.Count -eq 2) 'Tags not deduplicated'
  Send-NovelRequest 'DELETE' $null $novelUserB '/api/favorites?id=mysteries' | Out-Null
  Assert-Novel ((Send-NovelRequest 'GET' $null $novelUserA).Data.favorites.Count -eq 2) 'Other user could remove favorite'
  Send-NovelRequest 'DELETE' $null $novelUserA '/api/favorites?id=mysteries' | Out-Null
  Assert-Novel ((Send-NovelRequest 'GET' $null $novelUserA).Data.favorites.Count -eq 1) 'Removal failed'
  Write-Output 'API checks passed: unified catalog, platform provenance persistence, sync/search guards, authentication, user isolation, duplicates, validation, custom novels, removal.'
} finally {
  foreach ($novelUser in @($novelUserA,$novelUserB)) {
    $novelRemaining = Send-NovelRequest 'GET' $null $novelUser
    foreach ($novelBook in $novelRemaining.Data.favorites) { Send-NovelRequest 'DELETE' $null $novelUser ("/api/favorites?id=" + [uri]::EscapeDataString($novelBook.id)) | Out-Null }
  }
}
