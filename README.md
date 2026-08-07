# 🎬 Vibe Video Upscaler (updio)

<p align="center">
  <img src="src-tauri/icons/icon.png" alt="Vibe Video Upscaler 로고" width="160" height="160">
</p>

<p align="center">
  <b>AI 기술로 저해상도 영상을 고화질 4K로 재탄생시키는 지능형 비디오 업스케일러</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/Tauri-FFC131?style=for-the-badge&logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
</p>

---

## ✨ 새로운 정체성: updio

`updio`는 **UP** (Upscaling) + **Video**의 합성어로, 영상의 가치를 한 단계 높인다는 의미를 담고 있습니다. 새로운 로고는 상승하는 화살표와 재생 버튼의 결합을 통해 속도감과 고품질 영상 재생의 경험을 상징합니다.

## 🌟 주요 기능

- **🚀 AI 업스케일링:** Real-ESRGAN 모델을 활용하여 디테일을 살린 화질 개선.
- **⚡ 최적화된 성능:** Rust와 Python의 하이브리드 구조로 CPU/GPU 자원 효율적 관리.
- **🎨 모던한 경험:** 직관적인 UI와 실시간 진행률 대시보드.
- **🧰 모델 라이브러리:** Real-ESRGAN/Real-CUGAN 기본 모델을 확인하고, `.param`·`.bin` 모델 폴더를 앱 안에서 추가·삭제.
- **📦 원클릭 배포:** 설치 없이 바로 실행 가능한 포터블 버전과 정식 설치 파일 동시 지원.

## 🏗️ 아키텍처

**사이드카(Sidecar) 아키텍처** 기반으로 동작합니다:

1. **프론트엔드 (Next.js):** 사용자 인터페이스 및 상태 관리.
2. **백엔드 (Rust/Tauri):** 프로세스 조율, 권한 관리, 시스템 통신.
3. **코어 엔진 (Python 사이드카):** FFmpeg 처리 및 AI 모델 추론 실행.

## 🚀 시작하기

### 사전 요구사항

- **Node.js** v20 이상
- **Rust 툴체인**
- **Python 3.10 이상** (`pyinstaller` 포함)
- **FFmpeg** (설치 후 PATH 등록)

### 설치

1. **저장소 클론:**
    ```bash
    git clone https://github.com/jeiel85/updio.git
    cd updio
    ```

2. **의존성 설치:**
    ```bash
    npm install
    pip install pyinstaller
    ```

### 개발 및 빌드

1. **Python 엔진(사이드카) 빌드:**
    ```bash
    npm run build:sidecar
    ```

2. **개발 앱 실행:**
    ```bash
    npx tauri dev
    ```

3. **프로덕션 빌드:**
    ```bash
    npx tauri build
    ```

## 🛠️ 기술 구현 상세

- **Rust 백엔드:** `tauri-plugin-shell`로 사이드카를 안전하게 실행하고, `Emitter`로 실시간 진행 상황을 스트리밍.
- **Python 사이드카:** JSON 기반 stdout 프로토콜로 Rust 레이어와 통신.
- **CI/CD:** GitHub Actions로 빌드 및 릴리즈 자동화 (인스톨러 + 포터블 zip 제공).

## 📜 참고 프로젝트

- **[Video2X](https://github.com/k4yt3x/video2x):** 프레임 기반 영상 처리 로직 참고.
- **[Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN):** 핵심 AI 업스케일 엔진.
- **[Tauri Framework](https://tauri.app/):** 데스크탑 앱 프레임워크.

## 라이선스

updio 자체 코드는 MIT License로 배포됩니다. 릴리즈 패키지에는 FFmpeg, Real-ESRGAN, Real-CUGAN 계열 실행 파일/모델 등 별도 라이선스를 가진 구성요소가 포함될 수 있습니다. 자세한 내용은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 확인하세요.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/jeiel85">jeiel85</a>
</p>
