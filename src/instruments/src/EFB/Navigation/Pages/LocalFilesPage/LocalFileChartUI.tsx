import React, { useEffect, useState } from 'react';
import { ArrowReturnRight } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { usePersistentProperty } from '@instruments/common/persistence';
import { t } from '../../../translation';
import { LocalFileChart, LocalFileChartSelector, LocalFileOrganizedCharts } from './LocalFileChartSelector';
import { ScrollableContainer } from '../../../UtilComponents/ScrollableContainer';
import { SimpleInput } from '../../../UtilComponents/Form/SimpleInput/SimpleInput';
import { SelectGroup, SelectItem } from '../../../UtilComponents/Form/Select';
import { useAppDispatch, useAppSelector } from '../../../Store/store';
import { isSimbriefDataLoaded } from '../../../Store/features/simBrief';
import { NavigationTab, editTabProperty } from '../../../Store/features/navigationPage';
import { ChartViewer } from '../../Navigation';
import { Viewer } from '../../../../../../simbridge-client/src';

interface LocalFileCharts {
    images: LocalFileChart[];
    pdfs: LocalFileChart[];
}

export const LocalFileChartUI = () => {
    const dispatch = useAppDispatch();
    const [simbridgeEnabled] = usePersistentProperty('CONFIG_SIMBRIDGE_ENABLED', 'AUTO ON');
    const [statusBarInfo, setStatusBarInfo] = useState('');
    const [icaoAndNameDisagree, setIcaoAndNameDisagree] = useState(false);
    const [charts, setCharts] = useState<LocalFileCharts>({
        images: [],
        pdfs: [],
    });
    const [organizedCharts, setOrganizedCharts] = useState<LocalFileOrganizedCharts[]>([
        { name: 'IMAGE', alias: t('NavigationAndCharts.LocalFiles.Image'), charts: charts.images },
        { name: 'PDF', alias: t('NavigationAndCharts.LocalFiles.Pdf'), charts: charts.pdfs },
        { name: 'BOTH', alias: t('NavigationAndCharts.LocalFiles.Both'), charts: [...charts.images, ...charts.pdfs] },
    ]);
    const { searchQuery, isFullScreen, chartName, selectedTabIndex } = useAppSelector((state) => state.navigationTab[NavigationTab.LOCAL_FILES]);

    const updateSearchStatus = async () => {
        setIcaoAndNameDisagree(true);

        const searchableCharts: string[] = [];

        if (selectedTabIndex === 0 || selectedTabIndex === 2) {
            searchableCharts.push(...charts.images.map((image) => image.fileName));
        }

        if (selectedTabIndex === 1 || selectedTabIndex === 2) {
            searchableCharts.push(...charts.pdfs.map((pdf) => pdf.fileName));
        }

        const numItemsFound = searchableCharts.filter((chartName) => chartName.toUpperCase().includes(searchQuery)).length;

        setStatusBarInfo(`${numItemsFound} ${numItemsFound === 1 ? 'Item' : 'Items'} Found`);

        setIcaoAndNameDisagree(false);
    };

    const handleIcaoChange = (value: string) => {
        const newValue = value.toUpperCase();

        dispatch(editTabProperty({ tab: NavigationTab.LOCAL_FILES, searchQuery: newValue }));

        getLocalFileChartList(newValue).then((r) => setCharts(r));
    };

    useEffect(() => {
        handleIcaoChange(searchQuery);
    }, [selectedTabIndex]);

    useEffect(() => {
        updateSearchStatus();
    }, [charts]);

    useEffect(() => {
        setOrganizedCharts([
            { name: 'IMAGE', alias: t('NavigationAndCharts.LocalFiles.Image'), charts: charts.images },
            { name: 'PDF', alias: t('NavigationAndCharts.LocalFiles.Pdf'), charts: charts.pdfs },
            { name: 'BOTH', alias: t('NavigationAndCharts.LocalFiles.Both'), charts: [...charts.pdfs, ...charts.images] },
        ]);
    }, [charts]);

    useEffect(() => {
        dispatch(editTabProperty({ tab: NavigationTab.LOCAL_FILES, chartLinks: { light: chartName.light, dark: chartName.dark } }));
    }, [chartName]);

    const getLocalFileChartList = async (searchQuery: string): Promise<LocalFileCharts> => {
        const pdfs: LocalFileChart[] = [];
        const images: LocalFileChart[] = [];

        if (simbridgeEnabled !== 'AUTO ON') {
            return { images, pdfs }; // No need to search if simbridge is not enabled
        }

        try {
            // IMAGE or BOTH
            if (selectedTabIndex === 0 || selectedTabIndex === 2) {
                const imageNames: string[] = await Viewer.getImageList();
                imageNames.forEach((imageName) => {
                    if (imageName.toUpperCase().includes(searchQuery)) {
                        images.push({
                            fileName: imageName,
                            type: 'IMAGE',
                        });
                    }
                });
            }

            // PDF or BOTH
            if (selectedTabIndex === 1 || selectedTabIndex === 2) {
                const pdfNames: string[] = await Viewer.getPDFList();
                pdfNames.forEach((pdfName) => {
                    if (pdfName.toUpperCase().includes(searchQuery)) {
                        pdfs.push({
                            fileName: pdfName,
                            type: 'PDF',
                        });
                    }
                });
            }
        } catch (err) {
            toast.error('Error encountered while fetching resources.');
        }

        return {
            images,
            pdfs,
        };
    };

    const loading = icaoAndNameDisagree;

    const getStatusBarText = () => {
        if (!searchQuery.length) {
            return t('NavigationAndCharts.ShowingAllItems');
        }

        if (loading) {
            return t('NavigationAndCharts.PleaseWait');
        }

        return statusBarInfo;
    };

    const { altIcao, departingAirport, arrivingAirport } = useAppSelector((state) => state.simbrief.data);
    const simbriefDataLoaded = isSimbriefDataLoaded();

    return (
        <div className="flex overflow-x-hidden flex-row w-full h-content-section-reduced rounded-lg">
            <>
                {!isFullScreen && (
                    <div className="overflow-hidden flex-shrink-0" style={{ width: '450px' }}>
                        <div className="flex flex-row justify-center items-center">
                            <SimpleInput
                                placeholder={t('NavigationAndCharts.LocalFiles.FileName')}
                                value={searchQuery}
                                className={`w-full flex-shrink uppercase ${simbriefDataLoaded && 'rounded-r-none'}`}
                                onChange={handleIcaoChange}
                            />

                            {simbriefDataLoaded && (
                                <SelectGroup className="flex-shrink-0 rounded-l-none">
                                    <SelectItem
                                        className="uppercase"
                                        selected={searchQuery === departingAirport}
                                        onSelect={() => handleIcaoChange(departingAirport)}
                                    >
                                        {t('NavigationAndCharts.From')}
                                    </SelectItem>
                                    <SelectItem
                                        className="uppercase"
                                        selected={searchQuery === arrivingAirport}
                                        onSelect={() => handleIcaoChange(arrivingAirport)}
                                    >
                                        {t('NavigationAndCharts.To')}
                                    </SelectItem>
                                    {!!altIcao && (
                                        <SelectItem
                                            className="uppercase"
                                            selected={searchQuery === altIcao}
                                            onSelect={() => handleIcaoChange(altIcao)}
                                        >
                                            {t('NavigationAndCharts.Altn')}
                                        </SelectItem>
                                    )}
                                </SelectGroup>
                            )}
                        </div>

                        <div className="flex flex-row items-center w-full h-11">
                            <ArrowReturnRight size={30} />
                            <div className="block overflow-hidden px-4 w-full whitespace-nowrap" style={{ textOverflow: 'ellipsis' }}>
                                {getStatusBarText()}
                            </div>
                        </div>

                        <div className="mt-6">
                            <SelectGroup>
                                {organizedCharts.map((organizedChart, index) => (
                                    <SelectItem
                                        selected={index === selectedTabIndex}
                                        onSelect={() => dispatch(editTabProperty({ tab: NavigationTab.LOCAL_FILES, selectedTabIndex: index }))}
                                        key={organizedChart.name}
                                        className="flex justify-center w-full uppercase"
                                    >
                                        {organizedChart.alias}
                                    </SelectItem>
                                ))}
                            </SelectGroup>

                            <ScrollableContainer className="mt-5" height={42.75}>
                                <LocalFileChartSelector
                                    selectedTab={organizedCharts[selectedTabIndex]}
                                    loading={loading}
                                />
                            </ScrollableContainer>
                        </div>
                    </div>
                )}
                <ChartViewer />
            </>
        </div>
    );
};
