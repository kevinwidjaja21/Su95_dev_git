import React from 'react';
import { CloudArrowDown, Pin, PinFill } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { usePersistentProperty } from '@instruments/common/persistence';
import { t } from '../../../translation';
import {
    addPinnedChart,
    ChartProvider,
    editPinnedChart,
    editTabProperty,
    isChartPinned,
    NavigationTab,
    removedPinnedChart,
    setBoundingBox,
    setProvider,
} from '../../../Store/features/navigationPage';
import { useAppDispatch, useAppSelector } from '../../../Store/store';
import { navigationTabs } from '../../Navigation';
import { Viewer } from '../../../../../../simbridge-client/src';
import { getImageUrl, getPdfUrl } from './LocalFilesPage';

export type LocalFileChart = {
    fileName: string;
    type: 'IMAGE' | 'PDF';
};

export type LocalFileOrganizedCharts = {
    name: string,
    alias: string,
    charts: LocalFileChart[],
}
interface LocalFileChartSelectorProps {
    selectedTab: LocalFileOrganizedCharts;
    loading?: boolean;
}

export const LocalFileChartSelector = ({ selectedTab, loading }: LocalFileChartSelectorProps) => {
    const dispatch = useAppDispatch();

    const [simbridgeEnabled] = usePersistentProperty('CONFIG_SIMBRIDGE_ENABLED', 'AUTO ON');

    const { chartId, selectedTabIndex } = useAppSelector((state) => state.navigationTab[NavigationTab.LOCAL_FILES]);
    const { pinnedCharts } = useAppSelector((state) => state.navigationTab);

    if (loading) {
        return (
            <div
                className="flex justify-center items-center h-full rounded-md border-2 border-theme-accent"
                style={{ height: '42.75rem' }}
            >
                <CloudArrowDown className="animate-bounce" size={40} />
            </div>
        );
    }

    if (!selectedTab.charts.length) {
        return (
            <div
                className="flex justify-center items-center h-full rounded-md border-2 border-theme-accent"
                style={{ height: '42.75rem' }}
            >
                <p>{t('NavigationAndCharts.ThereAreNoChartsToDisplay')}</p>
            </div>
        );
    }

    const getChartResourceUrl = async (chart: LocalFileChart): Promise<string> => {
        try {
            if (chart.type === 'PDF') {
                return await getPdfUrl(chart.fileName, 1);
            }
            return await getImageUrl(chart.fileName);
        } catch (err) {
            return Promise.reject();
        }
    };

    const getPagesViewable = async (chart: LocalFileChart): Promise<number> => {
        if (simbridgeEnabled !== 'AUTO ON') {
            return Promise.reject();
        }
        if (chart.type === 'PDF') {
            try {
                return await Viewer.getPDFPageNum(chart.fileName);
            } catch (err) {
                return Promise.reject();
            }
        }
        return 1; // return 1 if called on a non-pdf file
    };

    const handleChartClick = async (chart: LocalFileChart) => {
        const oldChartId = chartId;
        dispatch(editTabProperty({ tab: NavigationTab.LOCAL_FILES, chartId: chart.fileName }));
        try {
            const url = await getChartResourceUrl(chart);
            dispatch(editTabProperty({ tab: NavigationTab.LOCAL_FILES, chartDimensions: { width: undefined, height: undefined } }));
            dispatch(editTabProperty({ tab: NavigationTab.LOCAL_FILES, chartName: { light: url, dark: url } }));
            dispatch(setBoundingBox(undefined));
            const pagesViewable = await getPagesViewable(chart);
            dispatch(editTabProperty({ tab: NavigationTab.LOCAL_FILES, pagesViewable }));
        } catch (_) {
            dispatch(editTabProperty({ tab: NavigationTab.LOCAL_FILES, chartId: oldChartId }));
            return;
        }
        dispatch(setProvider(ChartProvider.LOCAL_FILES));
        dispatch(editTabProperty({ tab: NavigationTab.LOCAL_FILES, currentPage: 1 }));
    };

    return (
        <div className="space-y-4">
            {selectedTab.charts.map((chart) => (
                <div
                    className="flex overflow-hidden flex-row w-full bg-theme-accent rounded-md"
                    onClick={() => handleChartClick(chart)}
                    key={chart.fileName}
                >
                    <div className="flex flex-row items-center">
                        <div className={`w-2 h-full transition flex-shrink-0 duration-100 ${chart.fileName === chartId
                            ? 'bg-theme-highlight'
                            : 'bg-theme-secondary'}`}
                        />
                        <div
                            className="flex items-center px-2 h-full hover:text-theme-body hover:bg-theme-highlight transition duration-100"
                            onClick={(event) => {
                                event.stopPropagation();

                                if (isChartPinned(chart.fileName)) {
                                    dispatch(removedPinnedChart({ chartId: chart.fileName }));
                                } else {
                                    /**
                                     * Pinning the chart with temporary values for chartName and pagesViewable
                                     * and editing them later to give a snappier experience as these values take time to be resolved.
                                     */
                                    dispatch(addPinnedChart({
                                        chartId: chart.fileName,
                                        chartName: { light: '', dark: '' },
                                        title: chart.fileName,
                                        subTitle: '',
                                        tabIndex: selectedTabIndex,
                                        timeAccessed: 0,
                                        tag: chart.type,
                                        provider: ChartProvider.LOCAL_FILES,
                                        pagesViewable: 1,
                                        pageIndex: navigationTabs.findIndex((tab) => tab.associatedTab === NavigationTab.LOCAL_FILES),
                                    }));

                                    Promise.all([getChartResourceUrl(chart), getPagesViewable(chart)]).then(([url, numPages]) => {
                                        dispatch(editPinnedChart({
                                            chartId: chart.fileName,
                                            chartName: { light: url, dark: url },
                                            pagesViewable: numPages,
                                        }));
                                    }).catch(() => {
                                        dispatch(removedPinnedChart({ chartId: chart.fileName }));
                                        toast.error('Unable to generate necessary resource to pin this item.');
                                    });
                                }
                            }}
                        >
                            {
                                pinnedCharts.some((pinnedChart) => pinnedChart.chartId === chart.fileName)
                                    ? <PinFill size={40} />
                                    : <Pin size={40} />
                            }
                        </div>
                    </div>
                    <div className="flex flex-col m-2">
                        <span>{chart.fileName}</span>
                        <span
                            className="px-2 mr-auto text-sm text-theme-text bg-theme-secondary rounded-sm"
                        >
                            {chart.type}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};
