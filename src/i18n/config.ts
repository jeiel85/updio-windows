import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  ko: {
    translation: {
      "title": "Vibe 비디오 업스케일러",
      "subtitle": "AI 기반 고해상도 비디오 향상 도구",
      "input_label": "입력 비디오 경로",
      "placeholder": "비디오 파일을 선택하세요...",
      "browse": "찾아보기",
      "scale": "확대 배율",
      "model": "AI 모델",
      "start": "업스케일링 시작",
      "processing": "처리 중...",
      "completed": "완료!",
      "error_occurred": "오류 발생",
      "preparing": "준비 중...",
      "success_msg": "성공! 업스케일링된 비디오가 저장되었습니다.",
      "initializing": "초기화 중...",
      "upscaling": "업스케일링 중",
      "merging": "병합 중...",
      "extracting": "프레임 추출 중..."
      ,"manage_models": "모델 관리"
      ,"model_manager_hint": "기본 모델을 확인하거나 나만의 모델 폴더를 추가하세요."
      ,"included": "기본 제공"
      ,"custom": "사용자 추가"
      ,"delete_model": "모델 삭제"
      ,"add_model": "모델 폴더 추가"
      ,"add_model_hint": ".param과 .bin 파일이 함께 있는 폴더를 선택하세요."
      ,"choose_model_folder": "폴더 선택"
      ,"custom_models_count": "개의 사용자 모델"
      ,"model_import_failed": "모델 추가 실패"
      ,"browse_error": "파일 선택 실패"
      ,"select_video_error": "먼저 비디오와 모델을 선택해 주세요"
    }
  },
  en: {
    translation: {
      "title": "Vibe Video Upscaler",
      "subtitle": "AI-powered high resolution video enhancement",
      "input_label": "Input Video Path",
      "placeholder": "Select a video file...",
      "browse": "Browse",
      "scale": "Scale",
      "model": "AI Model",
      "start": "Start Upscaling",
      "processing": "Processing...",
      "completed": "Completed!",
      "error_occurred": "Error occurred",
      "preparing": "Preparing...",
      "success_msg": "Success! Upscaled video saved to output path.",
      "initializing": "Initializing...",
      "upscaling": "Upscaling",
      "merging": "Merging...",
      "extracting": "Extracting frames..."
      ,"manage_models": "Manage models"
      ,"model_manager_hint": "Review included models or add your own model folder."
      ,"included": "Included"
      ,"custom": "Custom"
      ,"delete_model": "Delete model"
      ,"add_model": "Add model folder"
      ,"add_model_hint": "Choose a folder containing matching .param and .bin files."
      ,"choose_model_folder": "Choose folder"
      ,"custom_models_count": "custom models"
      ,"model_import_failed": "Model import failed"
      ,"browse_error": "File selection failed"
      ,"select_video_error": "Select a video and model first"
    }
  },
  ja: {
    translation: {
      "title": "Vibe ビデオアップスケーラー",
      "subtitle": "AI搭載の高解像度ビデオエンハンスメント",
      "input_label": "入力ビデオパス",
      "placeholder": "ビデオファイルを選択してください...",
      "browse": "参照",
      "scale": "拡大倍率",
      "model": "AIモデル",
      "start": "アップスケール開始",
      "processing": "処理中...",
      "completed": "完了！",
      "error_occurred": "エラーが発生しました",
      "preparing": "準備中...",
      "success_msg": "成功！アップスケールされたビデオが保存されました。",
      "initializing": "初期化中...",
      "upscaling": "アップスケール中",
      "merging": "結合中...",
      "extracting": "フレーム抽出中..."
      ,"manage_models": "モデル管理"
      ,"model_manager_hint": "標準モデルを確認するか、自分のモデルフォルダを追加してください。"
      ,"included": "標準搭載"
      ,"custom": "追加済み"
      ,"delete_model": "モデルを削除"
      ,"add_model": "モデルフォルダを追加"
      ,"add_model_hint": ".param と .bin ファイルが入ったフォルダを選択してください。"
      ,"choose_model_folder": "フォルダを選択"
      ,"custom_models_count": "個のカスタムモデル"
      ,"model_import_failed": "モデルの追加に失敗しました"
      ,"browse_error": "ファイル選択に失敗しました"
      ,"select_video_error": "動画とモデルを先に選択してください"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    }
  });

export default i18n;
