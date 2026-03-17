import { CloudArrowUp } from "@phosphor-icons/react";
import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import showToast from "../../../../../utils/toast";
import System from "../../../../../models/system";
import { useDropzone } from "react-dropzone";
import { v4 } from "uuid";
import FileUploadProgress from "./FileUploadProgress";
import Workspace from "../../../../../models/workspace";
import debounce from "lodash.debounce";

export default function UploadFile({
  workspace,
  fetchKeys,
  setLoading,
  setLoadingMessage,
}) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [files, setFiles] = useState([]);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [importingLinks, setImportingLinks] = useState(false);
  const linksFileInputRef = useRef(null);

  const handleImportLinksFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportingLinks(true);
      setLoading(true);
      setLoadingMessage("Reading links file...");

      const text = await file.text();
      const links = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && line.startsWith("http"));

      if (links.length === 0) {
        showToast("No valid URLs found in the file", "error");
        setImportingLinks(false);
        setLoading(false);
        return;
      }

      setLoadingMessage(`Processing ${links.length} links...`);

      const { response, data } = await Workspace.uploadLinksBulk(
        workspace.slug,
        links
      );

      if (!response.ok) {
        showToast(
          t("connectors.upload.import-error", { error: data.error }),
          "error"
        );
      } else {
        fetchKeys(true);
        showToast(
          t("connectors.upload.import-success", {
            successful: data.results?.successful || 0,
            failed: data.results?.failed || 0,
          }),
          "success"
        );
      }
    } catch (err) {
      console.error(err);
      showToast(
        t("connectors.upload.import-error", { error: err.message }),
        "error"
      );
    } finally {
      setImportingLinks(false);
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleSendLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoadingMessage("Scraping link...");
    setFetchingUrl(true);
    const formEl = e.target;
    const form = new FormData(formEl);
    const { response, data } = await Workspace.uploadLink(
      workspace.slug,
      form.get("link")
    );
    if (!response.ok) {
      showToast(`Error uploading link: ${data.error}`, "error");
    } else {
      fetchKeys(true);
      showToast("Link uploaded successfully", "success");
      formEl.reset();
    }
    setLoading(false);
    setFetchingUrl(false);
  };

  // Queue all fetchKeys calls through the same debouncer to prevent spamming the server.
  // either a success or error will trigger a fetchKeys call so the UI is not stuck loading.
  const debouncedFetchKeys = debounce(() => fetchKeys(true), 1000);
  const handleUploadSuccess = () => debouncedFetchKeys();
  const handleUploadError = () => debouncedFetchKeys();

  const onDrop = async (acceptedFiles, rejections) => {
    const newAccepted = acceptedFiles.map((file) => {
      return {
        uid: v4(),
        file,
      };
    });
    const newRejected = rejections.map((file) => {
      return {
        uid: v4(),
        file: file.file,
        rejected: true,
        reason: file.errors[0].code,
      };
    });
    setFiles([...newAccepted, ...newRejected]);
  };

  useEffect(() => {
    async function checkProcessorOnline() {
      const online = await System.checkDocumentProcessorOnline();
      setReady(online);
    }
    checkProcessorOnline();
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    disabled: !ready,
  });

  return (
    <div>
      <div
        className={`w-[560px] border-dashed border-[2px] border-theme-modal-border light:border-[#686C6F] rounded-2xl bg-theme-bg-primary transition-colors duration-300 p-3 ${
          ready
            ? " light:bg-[#E0F2FE] cursor-pointer hover:bg-theme-bg-secondary light:hover:bg-transparent"
            : "cursor-not-allowed"
        }`}
        {...getRootProps()}
      >
        <input {...getInputProps()} />
        {ready === false ? (
          <div className="flex flex-col items-center justify-center h-full">
            <CloudArrowUp className="w-8 h-8 text-white/80 light:invert" />
            <div className="text-white text-opacity-80 text-sm font-semibold py-1">
              {t("connectors.upload.processor-offline")}
            </div>
            <div className="text-white text-opacity-60 text-xs font-medium py-1 px-20 text-center">
              {t("connectors.upload.processor-offline-desc")}
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center">
            <CloudArrowUp className="w-8 h-8 text-white/80 light:invert" />
            <div className="text-white text-opacity-80 text-sm font-semibold py-1">
              {t("connectors.upload.click-upload")}
            </div>
            <div className="text-white text-opacity-60 text-xs font-medium py-1">
              {t("connectors.upload.file-types")}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 overflow-auto max-h-[180px] p-1 overflow-y-scroll no-scroll">
            {files.map((file) => (
              <FileUploadProgress
                key={file.uid}
                file={file.file}
                uuid={file.uid}
                setFiles={setFiles}
                slug={workspace.slug}
                rejected={file?.rejected}
                reason={file?.reason}
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
                setLoading={setLoading}
                setLoadingMessage={setLoadingMessage}
              />
            ))}
          </div>
        )}
      </div>
      <div className="text-center text-white text-opacity-50 text-xs font-medium w-[560px] py-2">
        {t("connectors.upload.or-submit-link")}
      </div>
      <form onSubmit={handleSendLink} className="flex gap-x-2">
        <input
          disabled={fetchingUrl || importingLinks}
          name="link"
          type="url"
          className="border-none disabled:bg-theme-settings-input-bg disabled:text-theme-settings-input-placeholder bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
          placeholder={t("connectors.upload.placeholder-link")}
          autoComplete="off"
        />
        <button
          disabled={fetchingUrl || importingLinks}
          type="submit"
          className="disabled:bg-white/20 disabled:text-slate-300 disabled:border-slate-400 disabled:cursor-wait bg bg-transparent hover:bg-slate-200 hover:text-slate-800 w-auto border border-white light:border-theme-modal-border text-sm text-white p-2.5 rounded-lg whitespace-nowrap"
        >
          {fetchingUrl
            ? t("connectors.upload.fetching")
            : t("connectors.upload.fetch-website")}
        </button>
      </form>
      <div className="flex gap-x-2 mt-2 w-[560px]">
        <input
          ref={linksFileInputRef}
          type="file"
          accept=".txt"
          onChange={handleImportLinksFile}
          className="hidden"
        />
        <button
          disabled={fetchingUrl || importingLinks}
          type="button"
          onClick={() => linksFileInputRef.current?.click()}
          title={t("connectors.upload.import-links-tooltip")}
          className="w-full disabled:bg-white/20 disabled:text-slate-300 disabled:border-slate-400 disabled:cursor-wait bg-transparent hover:bg-slate-200 hover:text-slate-800 border border-white light:border-theme-modal-border text-sm text-white p-2.5 rounded-lg"
        >
          {importingLinks
            ? t("connectors.upload.importing-links")
            : t("connectors.upload.import-links")}
        </button>
      </div>
      <div className="mt-6 text-center text-white text-opacity-80 text-xs font-medium w-[560px]">
        {t("connectors.upload.privacy-notice")}
      </div>
    </div>
  );
}
