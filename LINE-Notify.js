/*
１．Googleカレンダーから予定を読み込む
２．開始時刻でソート
３．明日の一番早い予定の開始時間を親に通知
４．全予定の一覧を自分に通知

Google calendat -> GAS -> LINE Notify
*/

/*
step 0  デバッグ用の環境構築
step 1  2つのカレンダーから予定を取得
step 2  統合してソート
step 3  投稿できるように整形
*/


/* step 0  デバッグ用の環境構築 */

var lineToken_to_me = /* LINE Notify との個人トークの token */;
var debug = 0; //デバッグするときは1などにすると3人のラインにはいかなくなる

if (debug == 0) {
  var lineToken_to_three = /* 家族とのグループトークの token */;
  var delta_day = 1; //今日の日付に対して何日後の予定を表示するか(変更しない)
} else {
  var lineToken_to_three = /* LINE Notify との個人トークの token */; //個人トーク・デバッグ用
  var delta_day = -1; //通常は明日の予定を表示するので1にする(適宜変更する)
};

/*****/


function main() {
  
  /* step 1  2つのカレンダーから予定を取得 */

  var date = new Date();
  date.setDate(date.getDate() + delta_day); //明日の予定を表示するので本来は+1、デバッグ用に適当に変更可能


  var unsorted_matrix = []
  var events_zero_counter = 0; //2つのカレンダーとも予定がない(=このカウンターが2になる)場合に分岐
  

  var calendars = CalendarApp.getAllCalendars(); //カレンダーをすべて配列で取得 [Calendar, Calendar, Calendar, ...]
  for(i in calendars) { //iは要素の番号
    
    var calendar = calendars[i]; //各カレンダー
    var calendar_name = calendar.getName()    
    
    if( calendar_name == /* calendar1 */ || calendar_name == /* calendar2 */ ) { //２つのカレンダーを考慮
      var events = calendar.getEventsForDay(date); //各カレンダー内の予定の配列 [event, event, event, ...]
      
      if( events.length == 0 ) {
        events_zero_counter += 1;
      } else {
        for(j in events) {
          var event = events[j];
          var title = event.getTitle();
          if(title.search(/*regexp pattern*/) != -1  /*titleを正規表現で検索*/ ) { //外部カレンダーから予定を読み込むと、ある予定が08:00-10:00で表示されるバグを回避
            var start = "00:00";
            var end = "00:00"; //終日の予定はendが00:00であるものと定義している
            //var event_text = start + ' - ' + end + '\n' + title + '\n' + '\n';
            var event_col = [start , end , title]
          } else {
            var start = toTime(event.getStartTime());
            var end = toTime(event.getEndTime());
            //var event_text = start + ' - ' + end + '\n' + title + '\n' + '\n';
            var event_col = [start , end , title]
          }
          unsorted_matrix.push(event_col);
        }
      }
      
    }
        
  }

  var text_to_me = "\n" + "今日もお疲れ様でした。\n明日、\n" + Utilities.formatDate(date, 'JST', 'yyyy/MM/dd') + "\nの予定をお知らせします。" + "\n\n" ;
  var text_to_three = "\n";
  
  
  //イベントがない場合ソートもできないので、先にイベントがない場合の処理をする
  
  if( events_zero_counter == 2 ) {
    text_to_me += "明日の予定はありません。";
    text_to_three += "明日の予定はありません。";
    sendToLine_to_me(text_to_me);
    sendToLine_to_three(text_to_three);
    return 0;
  } else {
    
    //unsorted_matrix をソート
    var sorted_matrix = [];
    while(unsorted_matrix.length > 0){
      var newest_index = 0;
      var newest_time = "99:99";
      for(i in unsorted_matrix){
        if(unsorted_matrix[i][0] < newest_time){
          newest_index = i;
          newest_time = unsorted_matrix[i][0];
        }
      }
      sorted_matrix.push(unsorted_matrix[newest_index])
      unsorted_matrix.splice(newest_index, 1)
    }

    //１日の予定の開始時間を決める
    var tomorrow_start = 0;
    for(i in sorted_matrix) {
      if(sorted_matrix[i][1] != "00:00") { //終了時刻が00:00でなければ終日の予定ではない
        tomorrow_start = sorted_matrix[i][0];
        break;
      }
    }
    
    if (tomorrow_start == 0) { //終日の予定しかない
      text_to_me += "明日の予定は\n\n";
      for(k in sorted_matrix) {
        text_to_me += "(終日) " + sorted_matrix[k][2] + '\n\n';
      }
      text_to_me += "です。";
      sendToLine_to_me(text_to_me);
      
      text_to_three += "明日の予定はありません。"
      sendToLine_to_three(text_to_three)
    
    } else {
      text_to_me += "明日最初の予定は " + tomorrow_start + " からです。\n\n" + "----------"　+ "\n\n";
      for(k in sorted_matrix) {
        if(sorted_matrix[k][1] == "00:00") {
          text_to_me += "(終日)\n" + sorted_matrix[k][2] + '\n\n';
        } else {
          text_to_me += sorted_matrix[k][0] + ' - ' + sorted_matrix[k][1] + '\n' + sorted_matrix[k][2] + '\n\n';
        }
      }
      sendToLine_to_me(text_to_me);
    
      text_to_three += "明日最初の予定は\n" + tomorrow_start + "\nからです。";
      sendToLine_to_three(text_to_three);
    
      return 0;
    }
  } 
}

//以下ツール(編集不可)

function sendToLine_to_me(text){
  var token = lineToken_to_me;
  var options =
   {
     "method"  : "post",
     "payload" : "message=" + text,
     "headers" : {"Authorization" : "Bearer "+ token}

   };
   UrlFetchApp.fetch("https://notify-api.line.me/api/notify", options);
}

function sendToLine_to_three(text){
  var token = lineToken_to_three;
  var options =
   {
     "method"  : "post",
     "payload" : "message=" + text,
     "headers" : {"Authorization" : "Bearer "+ token}

   };
   UrlFetchApp.fetch("https://notify-api.line.me/api/notify", options);
}

function toTime(str){
  return Utilities.formatDate(str, 'JST', 'HH:mm');
}